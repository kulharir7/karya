/**
 * File Tools — Special tools only (PDF, image, archive, batch)
 * 
 * Basic file operations (read, write, list, move, search) are now
 * handled by Mastra Workspace (LocalFilesystem) automatically.
 * 
 * These special tools have no Mastra equivalent:
 */

export { readPdfTool } from "./pdf";
export { resizeImageTool } from "./image";
export { zipFilesTool, unzipFilesTool } from "./archive";
export { batchRenameTool, fileSizeTool } from "./batch";

// NOTE: readFileTool, writeFileTool, listFilesTool, moveFileTool, searchFilesTool
// REMOVED — Mastra Workspace LocalFilesystem provides these automatically:
//   workspace_read, workspace_write, workspace_list, workspace_move, workspace_grep
