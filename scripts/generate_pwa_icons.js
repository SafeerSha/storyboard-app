const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function createSvg({
  width = 512,
  height = 512,
  rx = 0,
  stroke = false,
  scale = 13,
  fullBleed = true,
}) {
  const cx = width / 2;
  const cy = height / 2;
  // Bounding box of cubes in 32x32 view:
  // X: 6 -> 25.5 (center: 15.75)
  // Y: 6 -> 27.5 (center: 16.75)
  const tx = cx - 15.75 * scale;
  const ty = cy - 16.75 * scale;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">
  <defs>
    <!-- Porcelain Pearl Squircle Gradient -->
    <linearGradient id="cube-white-bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#FAF8F5"/>
      <stop offset="100%" stop-color="#F2EFE8"/>
    </linearGradient>

    <!-- Champagne Gold Perimeter Hairline Rim -->
    <linearGradient id="cube-rim" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FCE5A4" stop-opacity="0.95"/>
      <stop offset="35%" stop-color="#D4A73B" stop-opacity="0.65"/>
      <stop offset="70%" stop-color="#8A6014" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.2"/>
    </linearGradient>

    <!-- Top Face (Specular Champagne Light) -->
    <linearGradient id="cube-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFDF7"/>
      <stop offset="35%" stop-color="#FCEAB8"/>
      <stop offset="100%" stop-color="#E2B74B"/>
    </linearGradient>

    <!-- Left Face (Warm Satin Metallic Midtone) -->
    <linearGradient id="cube-left" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ECC670"/>
      <stop offset="55%" stop-color="#CCA038"/>
      <stop offset="100%" stop-color="#A1741D"/>
    </linearGradient>

    <!-- Right Face (Deep Honey-Bronze Shadow) -->
    <linearGradient id="cube-right" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#996D14"/>
      <stop offset="60%" stop-color="#734F0C"/>
      <stop offset="100%" stop-color="#473005"/>
    </linearGradient>

    <!-- Edge Specular Glint -->
    <linearGradient id="cube-glint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
      <stop offset="60%" stop-color="#FCE5A4" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#CCA038" stop-opacity="0.1"/>
    </linearGradient>

    <!-- Warm Amber-Bronze Ambient Drop Shadow -->
    <filter id="cube-drop" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.2" flood-color="#785312" flood-opacity="0.28"/>
      <feDropShadow dx="0" dy="0.6" stdDeviation="0.4" flood-color="#2A1B05" flood-opacity="0.20"/>
    </filter>
  </defs>

  ${
    fullBleed
      ? `<rect width="${width}" height="${height}" ${
          rx > 0 ? `rx="${rx}"` : ""
        } fill="url(#cube-white-bg)"/>`
      : ""
  }
  ${
    stroke && rx > 0
      ? `<rect x="2" y="2" width="${width - 4}" height="${
          height - 4
        }" rx="${Math.max(
          1,
          rx - 2
        )}" stroke="url(#cube-rim)" stroke-width="${Math.max(
          1,
          Math.round(width / 128)
        )}"/>`
      : ""
  }

  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <g filter="url(#cube-drop)">
      <!-- 1. TOP CUBE (Peak / Verified Delivery) -->
      <path d="M16.5 8.5L16.5 15L21 17.5L21 11Z" fill="url(#cube-left)"/>
      <path d="M21 11L21 17.5L25.5 15L25.5 8.5Z" fill="url(#cube-right)"/>
      <path d="M21 6L25.5 8.5L21 11L16.5 8.5Z" fill="url(#cube-top)"/>
      <path d="M21 6L16.5 8.5L21 11" stroke="url(#cube-glint)" stroke-width="0.6" stroke-linecap="round"/>

      <!-- 2. CENTER CUBE (Story Breakdown Tier) -->
      <path d="M11 13.5L11 20L15.5 22.5L15.5 16Z" fill="url(#cube-left)"/>
      <path d="M15.5 16L15.5 22.5L17.5 21.4L17.5 14.9Z" fill="url(#cube-right)"/>
      <path d="M15.5 11L20 13.5L15.5 16L11 13.5Z" fill="url(#cube-top)"/>
      <path d="M15.5 11L11 13.5L15.5 16" stroke="url(#cube-glint)" stroke-width="0.6" stroke-linecap="round"/>

      <!-- 3. BOTTOM-LEFT CUBE (Requirements Base Tier) -->
      <path d="M6 18.5L6 25L10.5 27.5L10.5 21Z" fill="url(#cube-left)"/>
      <path d="M10.5 21L10.5 27.5L15 25L15 18.5Z" fill="url(#cube-right)"/>
      <path d="M10.5 16L15 18.5L10.5 21L6 18.5Z" fill="url(#cube-top)"/>
      <path d="M10.5 16L6 18.5L10.5 21" stroke="url(#cube-glint)" stroke-width="0.6" stroke-linecap="round"/>

      <!-- 4. BOTTOM-RIGHT CUBE (Verified Output Tier) -->
      <path d="M16.5 18.5L16.5 25L21 27.5L21 21Z" fill="url(#cube-left)"/>
      <path d="M21 21L21 27.5L25.5 25L25.5 18.5Z" fill="url(#cube-right)"/>
      <path d="M21 16L25.5 18.5L21 21L16.5 18.5Z" fill="url(#cube-top)"/>
      <path d="M21 16L16.5 18.5L21 21" stroke="url(#cube-glint)" stroke-width="0.6" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
}

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4); // count

  let offset = 6 + 16 * count;
  const dirEntries = [];

  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([
    header,
    ...dirEntries,
    ...pngBuffers.map((p) => p.buffer),
  ]);
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public');

  console.log('Generating REQly PWA icons...');

  // 1. icon-512.png (Desktop PWA, taskbar, Start Menu)
  // Porcelain squircle badge with subtle champagne rim and gold 3D cubes
  const svg512Tile = createSvg({
    width: 512,
    height: 512,
    rx: 112,
    stroke: true,
    scale: 13,
    fullBleed: true,
  });
  await sharp(Buffer.from(svg512Tile))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ Created public/icon-512.png');

  // Also write public/icon.png
  await sharp(Buffer.from(svg512Tile))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon.png'));
  console.log('✓ Created public/icon.png');

  // 2. icon-192.png (Mobile & standard PWA manifest icon)
  const svg192Tile = createSvg({
    width: 192,
    height: 192,
    rx: 42,
    stroke: true,
    scale: 4.88,
    fullBleed: true,
  });
  await sharp(Buffer.from(svg192Tile))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ Created public/icon-192.png');

  // 3. icon-maskable-512.png (Android adaptive maskable icon)
  // Full-bleed porcelain background (no outer radius, the OS applies the mask),
  // with cubes sized strictly within the central 80% safe zone (scale = 12 fits safely in 410px circle)
  const svgMaskable512 = createSvg({
    width: 512,
    height: 512,
    rx: 0,
    stroke: false,
    scale: 12,
    fullBleed: true,
  });
  await sharp(Buffer.from(svgMaskable512))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('✓ Created public/icon-maskable-512.png');

  // 4. apple-touch-icon.png (iOS Home Screen - 180x180)
  // iOS HIG specifies square with opaque background; iOS applies rounded corners automatically.
  const svgApple180 = createSvg({
    width: 180,
    height: 180,
    rx: 0,
    stroke: false,
    scale: 4.5,
    fullBleed: true,
  });
  await sharp(Buffer.from(svgApple180))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Created public/apple-touch-icon.png');

  // 5. favicon.ico (16, 32, 48 multi-resolution Windows ICO)
  const icoSizes = [16, 32, 48];
  const icoPngBuffers = [];
  for (const size of icoSizes) {
    const svgIco = createSvg({
      width: size,
      height: size,
      rx: Math.round(size * 0.22),
      stroke: size >= 32,
      scale: size / 32 * 0.85,
      fullBleed: true,
    });
    const buf = await sharp(Buffer.from(svgIco))
      .png()
      .toBuffer();
    icoPngBuffers.push({ width: size, height: size, buffer: buf });
  }
  const icoBuffer = createIco(icoPngBuffers);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('✓ Created public/favicon.ico');

  // 6. public/icon.jpg (high-res 1024x1024 replacement of old initial commit icon.jpg)
  // This ensures that any stale cached request or external link to /icon.jpg delivers the new logo!
  const svg1024 = createSvg({
    width: 1024,
    height: 1024,
    rx: 224,
    stroke: true,
    scale: 26,
    fullBleed: true,
  });
  await sharp(Buffer.from(svg1024))
    .jpeg({ quality: 95 })
    .toFile(path.join(publicDir, 'icon.jpg'));
  console.log('✓ Created fallback public/icon.jpg with new brand mark');

  console.log('All icons generated successfully!');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
