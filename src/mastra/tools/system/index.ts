export { dateTimeTool, processListTool, openAppTool, killProcessTool } from "./advanced";

// Note: screenshotTool and analyzeImageTool are defined below in this file
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

export const systemInfoTool = createTool({
  id: "system-info",
  description: "Get system information: OS, CPU, memory, disk space, username, etc.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    os: z.string(),
    platform: z.string(),
    hostname: z.string(),
    username: z.string(),
    cpus: z.number(),
    totalMemoryGB: z.number(),
    freeMemoryGB: z.number(),
    homeDir: z.string(),
    cwd: z.string(),
  }),
  execute: async () => {
    return {
      os: `${os.type()} ${os.release()}`,
      platform: os.platform(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      cpus: os.cpus().length,
      totalMemoryGB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
      freeMemoryGB: Math.round((os.freemem() / 1073741824) * 10) / 10,
      homeDir: os.homedir(),
      cwd: process.cwd(),
    };
  },
});

export const clipboardReadTool = createTool({
  id: "clipboard-read",
  description: "Read the current contents of the system clipboard.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string(),
  }),
  execute: async () => {
    try {
      const content = execSync("powershell Get-Clipboard", {
        encoding: "utf-8",
      }).trim();
      return { success: true, content };
    } catch {
      return { success: false, content: "" };
    }
  },
});

export const clipboardWriteTool = createTool({
  id: "clipboard-write",
  description: "Write text to the system clipboard.",
  inputSchema: z.object({
    text: z.string().describe("Text to copy to clipboard"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ text }) => {
    try {
      const escaped = text.replace(/'/g, "''");
      execSync(`powershell "Set-Clipboard -Value '${escaped}'"`, {
        encoding: "utf-8",
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
});

export const notifyTool = createTool({
  id: "system-notify",
  description: "Show a desktop notification to the user.",
  inputSchema: z.object({
    title: z.string().describe("Notification title"),
    message: z.string().describe("Notification message"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ title, message }) => {
    try {
      execSync(
        `powershell "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}')"`,
        { encoding: "utf-8", timeout: 10000 }
      );
      return { success: true };
    } catch {
      return { success: false };
    }
  },
});

/**
 * Screenshot Tool — Capture the user's screen
 * Returns base64 image for vision model analysis
 */
export const screenshotTool = createTool({
  id: "system-screenshot",
  description: 
    "Take a screenshot of the user's screen. Use this when user asks to 'look at my screen', " +
    "'see what's happening', 'check this error', 'dekh kya ho raha hai', or any request that " +
    "requires seeing the current screen. Returns the screenshot for analysis.",
  inputSchema: z.object({
    monitor: z.number().optional().describe("Monitor index (0 = primary, 1 = secondary). Default: 0"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    imagePath: z.string(),
    base64: z.string(),
    mimeType: z.string(),
    width: z.number(),
    height: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ monitor = 0 }) => {
    try {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const filename = `screenshot-${Date.now()}.png`;
      const filePath = path.join(uploadDir, filename);
      const filePathEscaped = filePath.replace(/\\/g, '\\\\');
      
      // Write PowerShell script to temp file (avoids escaping issues)
      const psScriptPath = path.join(uploadDir, `capture-${Date.now()}.ps1`);
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screens = [System.Windows.Forms.Screen]::AllScreens
$screenIndex = [Math]::Min(${monitor}, $screens.Length - 1)
$screen = $screens[$screenIndex]
$bounds = $screen.Bounds

$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$bitmap.Save("${filePathEscaped}", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "$($bounds.Width)x$($bounds.Height)"
`;
      
      fs.writeFileSync(psScriptPath, psScript, "utf-8");
      
      const result = execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
        encoding: "utf-8",
        timeout: 15000,
      }).trim();
      
      // Cleanup script
      try { fs.unlinkSync(psScriptPath); } catch {}
      
      // Parse dimensions
      const [width, height] = result.split("x").map(Number);
      
      // Read as base64
      const imageBuffer = fs.readFileSync(filePath);
      const base64 = imageBuffer.toString("base64");
      
      return {
        success: true,
        imagePath: filePath,
        base64,
        mimeType: "image/png",
        width: width || 1920,
        height: height || 1080,
      };
    } catch (err: any) {
      return {
        success: false,
        imagePath: "",
        base64: "",
        mimeType: "",
        width: 0,
        height: 0,
        error: err.message,
      };
    }
  },
});

/**
 * Analyze Image Tool — Use vision model to analyze an image
 * Can analyze screenshots or any image file
 */
export const analyzeImageTool = createTool({
  id: "analyze-image",
  description: 
    "Analyze an image using vision AI. Use AFTER taking a screenshot with system-screenshot, " +
    "or to analyze any image file. Pass the base64 data or file path from the screenshot result. " +
    "Returns a detailed description of what's visible in the image.",
  inputSchema: z.object({
    base64: z.string().optional().describe("Base64-encoded image data (from screenshot result)"),
    imagePath: z.string().optional().describe("Path to image file to analyze"),
    question: z.string().optional().describe("Specific question about the image. Default: describe what you see"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    analysis: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ base64, imagePath, question }) => {
    try {
      let imageData = base64;
      
      // If path provided, read file
      if (!imageData && imagePath) {
        if (!fs.existsSync(imagePath)) {
          return { success: false, analysis: "", error: `File not found: ${imagePath}` };
        }
        const buffer = fs.readFileSync(imagePath);
        imageData = buffer.toString("base64");
      }
      
      if (!imageData) {
        return { success: false, analysis: "", error: "No image provided. Pass base64 or imagePath." };
      }
      
      // Use OpenAI-compatible vision API
      const baseURL = process.env.LLM_BASE_URL || "https://ollama.com/v1";
      const apiKey = process.env.LLM_API_KEY || "ollama";
      // Use a vision-capable model (fallback to same model if not specified)
      const visionModel = process.env.VISION_MODEL || process.env.LLM_MODEL || "qwen3-coder:480b";
      
      const prompt = question || "Describe what you see in this image in detail. If it's a screen capture, identify the application, any errors, text, UI elements, and what the user might be working on.";
      
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${imageData}` },
                },
              ],
            },
          ],
          max_tokens: 1000,
        }),
      });
      
      if (!response.ok) {
        const errText = await response.text();
        // If model doesn't support vision, provide helpful error
        if (errText.includes("vision") || errText.includes("image") || response.status === 400) {
          return {
            success: false,
            analysis: "",
            error: `Vision not supported by model ${visionModel}. Screenshot saved to ${imagePath || 'uploads/'}. Try a vision model like gpt-4o or llava.`,
          };
        }
        return { success: false, analysis: "", error: `Vision API error: ${errText}` };
      }
      
      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content || "No analysis returned";
      
      return { success: true, analysis };
    } catch (err: any) {
      return { success: false, analysis: "", error: err.message };
    }
  },
});
