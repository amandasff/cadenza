import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const htmlPath = resolve(import.meta.dir, "generate-slides.html");
const outDir = resolve(import.meta.dir, "..", "public", "slides");
const tmpDir = resolve(import.meta.dir, "tmp-slides");
const chrome = "C:/Users/amand/.cache/puppeteer/chrome/win64-147.0.7727.56/chrome-win64/chrome.exe";

mkdirSync(tmpDir, { recursive: true });

const html = readFileSync(htmlPath, "utf-8");

// Extract style block
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const styles = styleMatch ? styleMatch[1] : "";

// Split by slide comment markers
const parts = html.split(/<!-- SLIDE \d+:.*?-->\n?/);
// parts[0] is before slide 1, parts[1..10] are the slide contents
const slideContents = parts.slice(1); // 10 slides

// Last slide may have the <script> tag, remove it
const lastIdx = slideContents.length - 1;
slideContents[lastIdx] = slideContents[lastIdx].replace(/<script>[\s\S]*$/, "");

console.log(`Found ${slideContents.length} slides`);

const fixedStyles = styles
  .replace(/\.slide\s*\{[^}]*\}/, `.slide { width:800px; height:1000px; position:relative; overflow:hidden; display:block; background:#F8F6F2; color:#2C2824; }`)
  .replace(/\.slide:target\s*\{[^}]*\}/, "")
  .replace(/\.slide\.active\s*\{[^}]*\}/, "")
  + `\n  body { margin:0; padding:0; overflow:hidden; background:#F8F6F2; }
  html { overflow:hidden; }
  ::-webkit-scrollbar { display:none; }`;

for (let i = 0; i < slideContents.length; i++) {
  const slideId = i + 1;

  const standalone = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
${fixedStyles}
</style>
</head><body>
${slideContents[i].trim()}
</body></html>`;

  const tmpFile = resolve(tmpDir, `slide-${slideId}.html`);
  writeFileSync(tmpFile, standalone);

  const num = String(slideId).padStart(2, "0");
  const outFile = resolve(outDir, `${num}.png`);
  const fileUrl = `file:///${tmpFile.replace(/\\/g, "/")}`;

  try {
    execSync(
      `"${chrome}" --headless --disable-gpu --hide-scrollbars --run-all-compositor-stages-before-draw --virtual-time-budget=10000 --screenshot="${outFile}" --window-size=800,1000 "${fileUrl}"`,
      { timeout: 30000, stdio: "pipe" }
    );
    console.log(`Captured slide ${slideId}`);
  } catch (e: any) {
    console.error(`Failed slide ${slideId}: ${e.message}`);
  }
}

console.log("Done!");
