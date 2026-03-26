import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "karya-settings.json");

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch {}
  return { model: process.env.LLM_MODEL || "gpt-oss:120b", baseUrl: process.env.LLM_BASE_URL || "https://ollama.com/v1" };
}

function writeSettings(settings: any) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export async function GET() {
  return Response.json(readSettings());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const current = readSettings();
  const updated = { ...current, ...body };
  writeSettings(updated);

  // Update env vars at runtime
  if (body.model) process.env.LLM_MODEL = body.model;
  if (body.baseUrl) process.env.LLM_BASE_URL = body.baseUrl;

  return Response.json({ success: true, settings: updated });
}
