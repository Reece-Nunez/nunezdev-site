const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const LOGO_SRC = path.join(PUBLIC_DIR, 'logo.png');

const BG = { r: 11, g: 42, b: 74, alpha: 1 };

async function generate(size, filename, padPct = 0.18) {
  const inner = Math.round(size * (1 - padPct * 2));
  const logo = await sharp(LOGO_SRC)
    .resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, filename));

  console.log(`Wrote ${filename} (${size}x${size})`);
}

async function generateMaskable(size, filename) {
  return generate(size, filename, 0.22);
}

(async () => {
  await generate(192, 'icon-192.png', 0.12);
  await generate(512, 'icon-512.png', 0.12);
  await generateMaskable(512, 'icon-maskable-512.png');
  await generate(180, 'apple-touch-icon.png', 0.10);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
