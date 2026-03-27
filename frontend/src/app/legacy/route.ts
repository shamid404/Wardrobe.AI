import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  // Read the existing legacy UI from the repo root.
  // This keeps the port effort small while we proxy API calls to FastAPI.
  const filePath = path.resolve(process.cwd(), "..", "index.html");
  const html = await fs.readFile(filePath, "utf8");

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

