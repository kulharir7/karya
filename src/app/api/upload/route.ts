import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

// Image MIME types that support vision
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return Response.json({ error: "No file" }, { status: 400 });

    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, file.name);
    fs.writeFileSync(filePath, buffer);

    const isImage = IMAGE_TYPES.includes(file.type);
    
    // For images, also return base64 for vision model
    let base64Data: string | undefined;
    let mimeType: string | undefined;
    
    if (isImage) {
      base64Data = buffer.toString("base64");
      mimeType = file.type;
    }

    return Response.json({
      success: true,
      path: filePath,
      name: file.name,
      size: file.size,
      sizeFormatted: file.size < 1048576
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / 1048576).toFixed(1)} MB`,
      isImage,
      mimeType,
      base64: base64Data, // For vision model
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
