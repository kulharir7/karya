/**
 * Karya Docker Sandbox
 * 
 * Execute code safely inside Docker containers:
 * - Memory limits
 * - No network access
 * - Timeout
 * - Read-only filesystem
 * 
 * Requires Docker to be installed.
 */

import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { logger } from "./logger";

export interface SandboxConfig {
  memoryMb?: number;       // Memory limit (default 256MB)
  timeoutSeconds?: number; // Execution timeout (default 30s)
  networkEnabled?: boolean; // Allow network access (default false)
  workDir?: string;        // Working directory
  image?: string;          // Docker image to use
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  error?: string;
}

const DEFAULT_CONFIG: Required<SandboxConfig> = {
  memoryMb: 256,
  timeoutSeconds: 30,
  networkEnabled: false,
  workDir: "/workspace",
  image: "node:20-alpine", // Default for JS
};

const LANGUAGE_IMAGES: Record<string, string> = {
  javascript: "node:20-alpine",
  typescript: "node:20-alpine",
  python: "python:3.11-alpine",
  bash: "alpine:latest",
  sh: "alpine:latest",
};

const LANGUAGE_COMMANDS: Record<string, string[]> = {
  javascript: ["node"],
  typescript: ["npx", "tsx"],
  python: ["python3"],
  bash: ["bash"],
  sh: ["sh"],
};

/**
 * Check if Docker is available
 */
export function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute code in Docker sandbox
 */
export async function executeInSandbox(
  code: string,
  language: string,
  config: SandboxConfig = {}
): Promise<SandboxResult> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Check Docker availability
  if (!isDockerAvailable()) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: Date.now() - startTime,
      error: "Docker not available. Install Docker to use sandbox execution.",
    };
  }

  // Determine image and command
  const image = LANGUAGE_IMAGES[language.toLowerCase()] || opts.image;
  const cmd = LANGUAGE_COMMANDS[language.toLowerCase()] || ["sh", "-c"];

  // Create temp directory for code
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "karya-sandbox-"));
  const scriptFile = path.join(tempDir, getScriptFilename(language));

  try {
    // Write code to file
    fs.writeFileSync(scriptFile, code, "utf-8");

    // Build Docker command
    const dockerArgs = [
      "run",
      "--rm",
      "-i",
      `--memory=${opts.memoryMb}m`,
      `--memory-swap=${opts.memoryMb}m`, // No swap
      "--cpus=1",
      opts.networkEnabled ? "" : "--network=none",
      "--read-only",
      "--tmpfs=/tmp:rw,size=64m",
      `-v=${tempDir}:${opts.workDir}:ro`,
      `-w=${opts.workDir}`,
      "--user=1000:1000", // Non-root
      image,
      ...cmd,
      path.basename(scriptFile),
    ].filter(Boolean);

    logger.info("sandbox", `Running ${language} code in Docker: ${image}`);

    // Execute with timeout
    const result = await executeWithTimeout(
      "docker",
      dockerArgs,
      opts.timeoutSeconds * 1000
    );

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: Date.now() - startTime,
    };

  } catch (err: any) {
    return {
      success: false,
      stdout: "",
      stderr: err.message,
      exitCode: 1,
      durationMs: Date.now() - startTime,
      error: err.message,
    };
  } finally {
    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }
  }
}

/**
 * Execute command with timeout
 */
function executeWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      process.kill("SIGKILL");
      reject(new Error(`Execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      clearTimeout(timer);
      if (!killed) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      }
    });

    process.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Get appropriate filename for language
 */
function getScriptFilename(language: string): string {
  switch (language.toLowerCase()) {
    case "javascript": return "script.js";
    case "typescript": return "script.ts";
    case "python": return "script.py";
    case "bash":
    case "sh": return "script.sh";
    default: return "script.txt";
  }
}

/**
 * Safe execute — uses sandbox if Docker available, falls back to local
 */
export async function safeExecute(
  code: string,
  language: string,
  config?: SandboxConfig
): Promise<SandboxResult> {
  if (isDockerAvailable()) {
    return executeInSandbox(code, language, config);
  }

  // Fallback: local execution with warning
  logger.warn("sandbox", "Docker not available, falling back to local execution");
  
  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "karya-local-"));
    const scriptFile = path.join(tempDir, getScriptFilename(language));
    fs.writeFileSync(scriptFile, code, "utf-8");

    const cmd = language.toLowerCase() === "python" ? "python3" : "node";
    const result = execSync(`${cmd} "${scriptFile}"`, {
      encoding: "utf-8",
      timeout: (config?.timeoutSeconds || 30) * 1000,
      maxBuffer: 5 * 1024 * 1024,
    });

    fs.rmSync(tempDir, { recursive: true, force: true });

    return {
      success: true,
      stdout: result,
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    };
  } catch (err: any) {
    return {
      success: false,
      stdout: err.stdout || "",
      stderr: err.stderr || err.message,
      exitCode: err.status || 1,
      durationMs: 0,
    };
  }
}
