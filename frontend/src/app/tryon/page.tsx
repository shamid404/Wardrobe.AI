import fs from "node:fs/promises";
import path from "node:path";

import { TryOnStudio } from "@/components/tryon/TryOnStudio";

export default async function TryOnPage() {
  // Pull the legacy UI CSS from the existing index.html and inject it.
  // We intentionally strip the old fixed-color `:root { ... }` to keep your new palette from `globals.css`.
  const legacyHtmlPath = path.resolve(process.cwd(), "..", "index.html");
  const legacyHtml = await fs.readFile(legacyHtmlPath, "utf8");

  const styleMatch = legacyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const legacyStyle = styleMatch?.[1] ?? "";

  // Remove the first `:root { ... }` block only (it contains old palette).
  let strippedCss = legacyStyle.replace(/:root\s*\{[\s\S]*?\}\s*/i, "");

  // Replace legacy hardcoded colors (gold/accent/success) so they follow your palette.
  // These rgba constants are present in index.html's <style>.
  strippedCss = strippedCss
    .replace(/rgba\(201,168,76,/g, "rgba(var(--gold-rgb),")
    .replace(/rgba\(184,115,51,/g, "rgba(var(--accent-rgb),")
    .replace(/rgba\(92,140,106,/g, "rgba(var(--success-rgb),");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: strippedCss }} />
      <TryOnStudio />
    </>
  );
}

