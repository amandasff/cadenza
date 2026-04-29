import sharp from "sharp";
import { resolve } from "path";
import { readFileSync } from "fs";

const slidesDir = resolve(import.meta.dir, "..", "public", "slides");

interface Patch {
  x: number; y: number; w: number; h: number;
  bg: string;
  text?: string; textColor?: string; fontSize?: number; fontWeight?: string;
}

// Each slide's patches: cover old name with bg color, optionally add new text
const patches: Record<string, Patch[]> = {
  "01.png": [
    // Sidebar "Amanda Wu"
    { x: 48, y: 82, w: 120, h: 18, bg: "#F8F6F2", text: "Sophie L.", textColor: "#2C2824", fontSize: 14, fontWeight: "600" },
    // Chat "Amanda Wu / Open chat"
    { x: 128, y: 185, w: 120, h: 18, bg: "#F8F6F2", text: "Sophie L.", textColor: "#2C2824", fontSize: 14, fontWeight: "600" },
  ],
  "03.png": [
    // Leaderboard names
    { x: 126, y: 216, w: 80, h: 22, bg: "#F8F6F2", text: "Marcus", textColor: "#2C2824", fontSize: 16, fontWeight: "600" },
    { x: 126, y: 260, w: 110, h: 22, bg: "#F8F6F2", text: "Lily Chen", textColor: "#2C2824", fontSize: 16, fontWeight: "600" },
    { x: 126, y: 304, w: 120, h: 22, bg: "#F8F6F2", text: "Jordan R.", textColor: "#2C2824", fontSize: 16, fontWeight: "600" },
    // Note ID scores line
    { x: 126, y: 440, w: 200, h: 16, bg: "#F8F6F2" },
    { x: 126, y: 440, w: 350, h: 16, bg: "#F8F6F2", text: "Marcus 6,913    You 6,776    Jordan R. 5,038", textColor: "#9A9590", fontSize: 11 },
  ],
  "05.png": [
    // Discover feed artist names - these are small and scattered
    // "Queenie Tan" under recordings
    { x: 30, y: 268, w: 180, h: 14, bg: "#F8F6F2", text: "Lily Chen · following", textColor: "#9A9590", fontSize: 10 },
    { x: 250, y: 268, w: 190, h: 14, bg: "#F8F6F2", text: "Lily Chen · following", textColor: "#9A9590", fontSize: 10 },
    { x: 30, y: 490, w: 180, h: 14, bg: "#F8F6F2", text: "Lily Chen · following", textColor: "#9A9590", fontSize: 10 },
    { x: 250, y: 490, w: 120, h: 14, bg: "#F8F6F2", text: "Sophie L.", textColor: "#9A9590", fontSize: 10 },
  ],
  "07.png": [
    // Profile header "Amanda Wu"
    { x: 260, y: 42, w: 160, h: 28, bg: "#F8F6F2", text: "Sophie L.", textColor: "#2C2824", fontSize: 22, fontWeight: "600" },
    // Sidebar "Amanda Wu"
    { x: 48, y: 130, w: 120, h: 18, bg: "#F8F6F2", text: "Sophie L.", textColor: "#2C2824", fontSize: 14, fontWeight: "600" },
  ],
  "08.png": [
    // Sidebar "Amanda Wu" is likely hidden/scrolled
  ],
  "10.png": [
    // "Amanda Wu's Studio" header
    { x: 260, y: 112, w: 220, h: 28, bg: "#F8F6F2", text: "Sophie's Studio", textColor: "#2C2824", fontSize: 20, fontWeight: "bold" },
    // Sidebar "Amanda Wu"
    { x: 48, y: 96, w: 120, h: 18, bg: "#F8F6F2", text: "Sophie L.", textColor: "#2C2824", fontSize: 14, fontWeight: "600" },
    // "cadenza.social/ amanda"
    { x: 186, y: 248, w: 80, h: 18, bg: "#F8F6F2", text: "sophie", textColor: "#2C2824", fontSize: 14, fontWeight: "bold" },
  ],
};

async function processSlide(filename: string, slidePatches: Patch[]) {
  const filepath = resolve(slidesDir, filename);
  const image = sharp(filepath);
  const meta = await image.metadata();
  const w = meta.width!;
  const h = meta.height!;

  // Build SVG overlay
  const svgParts = slidePatches.map(p => {
    let svg = `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.bg}" />`;
    if (p.text) {
      const ty = p.y + (p.fontSize || 14) + 2;
      svg += `<text x="${p.x + 2}" y="${ty}" font-family="sans-serif" font-size="${p.fontSize || 14}" font-weight="${p.fontWeight || 'normal'}" fill="${p.textColor || '#000'}">${p.text.replace(/&/g, '&amp;')}</text>`;
    }
    return svg;
  });

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${svgParts.join("")}</svg>`;

  const result = await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toBuffer();

  await sharp(result).toFile(filepath);
  console.log(`Patched ${filename}`);
}

for (const [filename, slidePatches] of Object.entries(patches)) {
  if (slidePatches.length > 0) {
    await processSlide(filename, slidePatches);
  }
}

console.log("Done!");
