import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const zipFilesTool = createTool({
  id: "file-zip",
  description:
    "Create a ZIP archive from files or a folder. Use when user wants to " +
    "compress files, create a zip, or bundle files together.",
  inputSchema: z.object({
    sourcePath: z.string().describe("Path to file or folder to zip"),
    outputPath: z.string().optional().describe("Output zip path (optional, defaults to source_name.zip)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    outputPath: z.string(),
    info: z.string(),
  }),
  execute: async ({ sourcePath, outputPath }) => {
    try {
      const archiver = (await import("archiver")).default;
      const resolved = path.resolve(sourcePath);
      const outPath = outputPath
        ? path.resolve(outputPath)
        : resolved.replace(/\/?$/, "") + ".zip";

      const output = fs.createWriteStream(outPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      return new Promise((resolve) => {
        output.on("close", () => {
          resolve({
            success: true,
            outputPath: outPath,
            info: `Created ${(archive.pointer() / 1024).toFixed(1)} KB zip`,
          });
        });

        archive.on("error", (err: any) => {
          resolve({
            success: false,
            outputPath: "",
            info: `Error: ${err.message}`,
          });
        });

        archive.pipe(output);

        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          archive.directory(resolved, path.basename(resolved));
        } else {
          archive.file(resolved, { name: path.basename(resolved) });
        }
        archive.finalize();
      });
    } catch (err: any) {
      return {
        success: false,
        outputPath: "",
        info: `Error: ${err.message}`,
      };
    }
  },
});

export const unzipFilesTool = createTool({
  id: "file-unzip",
  description:
    "Extract a ZIP archive. Use when user wants to unzip, extract, or decompress a zip file.",
  inputSchema: z.object({
    zipPath: z.string().describe("Path to the ZIP file"),
    outputDir: z.string().optional().describe("Output directory (optional, defaults to same folder)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    outputDir: z.string(),
    info: z.string(),
  }),
  execute: async ({ zipPath, outputDir }) => {
    try {
      const unzipper = await import("unzipper");
      const resolved = path.resolve(zipPath);
      const outDir = outputDir
        ? path.resolve(outputDir)
        : path.join(path.dirname(resolved), path.basename(resolved, ".zip"));

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(resolved)
          .pipe(unzipper.Extract({ path: outDir }))
          .on("close", resolve)
          .on("error", reject);
      });

      const files = fs.readdirSync(outDir);
      return {
        success: true,
        outputDir: outDir,
        info: `Extracted ${files.length} items to ${outDir}`,
      };
    } catch (err: any) {
      return {
        success: false,
        outputDir: "",
        info: `Error: ${err.message}`,
      };
    }
  },
});
