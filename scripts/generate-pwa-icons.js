const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const logoPath = path.join(__dirname, '../public/neximet-logo.avif');
  const iconsDir = path.join(__dirname, '../public/icons');
  const publicDir = path.join(__dirname, '../public');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // 1. Convert AVIF to PNG buffer and extract clean emblem
  const logoBuf = await sharp(logoPath).png().toBuffer();
  const emblemBuf = await sharp(logoBuf)
    .extract({ left: 598, top: 0, width: 326, height: 453 })
    .png()
    .toBuffer()
    .then(buf => sharp(buf).trim().toBuffer());

  const emblemMeta = await sharp(emblemBuf).metadata();
  console.log('Emblem dimensions:', emblemMeta.width, emblemMeta.height);

  // 2. Base 1024x1024 icon backdrop
  const baseSize = 1024;
  const targetEmblemHeight = 600;
  const targetEmblemWidth = Math.round((emblemMeta.width / emblemMeta.height) * targetEmblemHeight);

  const resizedEmblemBuf = await sharp(emblemBuf)
    .resize(targetEmblemWidth, targetEmblemHeight, { fit: 'contain' })
    .toBuffer();

  const backgroundSvg = Buffer.from(`
    <svg width="${baseSize}" height="${baseSize}" viewBox="0 0 ${baseSize} ${baseSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#5470F4" stop-opacity="0.32"/>
          <stop offset="60%" stop-color="#5CC5FA" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="#0B0F19" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5CC5FA" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="#5470F4" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#1F293D" stop-opacity="0.2"/>
        </linearGradient>
      </defs>
      <!-- Base deep background -->
      <rect width="${baseSize}" height="${baseSize}" rx="220" fill="#0B0F19"/>
      <!-- Ambient central glow -->
      <circle cx="${baseSize/2}" cy="${baseSize/2}" r="460" fill="url(#centerGlow)"/>
      <!-- Sleek inner squircle stroke -->
      <rect x="24" y="24" width="${baseSize - 48}" height="${baseSize - 48}" rx="200" fill="none" stroke="url(#borderGrad)" stroke-width="8"/>
    </svg>
  `);

  const masterIconBuf = await sharp(backgroundSvg)
    .composite([
      {
        input: resizedEmblemBuf,
        top: Math.round((baseSize - targetEmblemHeight) / 2),
        left: Math.round((baseSize - targetEmblemWidth) / 2),
      },
    ])
    .png()
    .toBuffer();

  // 3. Generate standard sizes
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const size of sizes) {
    await sharp(masterIconBuf)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }

  // 4. Generate Apple Touch Icon (180x180)
  await sharp(masterIconBuf)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 5. Generate Favicons (32x32, 16x16)
  await sharp(masterIconBuf)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(masterIconBuf)
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));

  // 6. Generate Maskable Icon (safe area: centered emblem with full-bleed solid background)
  const maskableSvg = Buffer.from(`
    <svg width="${baseSize}" height="${baseSize}" viewBox="0 0 ${baseSize} ${baseSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="maskGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#5470F4" stop-opacity="0.32"/>
          <stop offset="60%" stop-color="#5CC5FA" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="#0B0F19" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${baseSize}" height="${baseSize}" fill="#0B0F19"/>
      <circle cx="${baseSize/2}" cy="${baseSize/2}" r="460" fill="url(#maskGlow)"/>
    </svg>
  `);

  const maskableMasterBuf = await sharp(maskableSvg)
    .composite([
      {
        input: resizedEmblemBuf,
        top: Math.round((baseSize - targetEmblemHeight) / 2),
        left: Math.round((baseSize - targetEmblemWidth) / 2),
      },
    ])
    .png()
    .toBuffer();

  await sharp(maskableMasterBuf)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'maskable-icon-512x512.png'));
  console.log('Generated maskable-icon-512x512.png');

  console.log('All PWA icon assets generated successfully!');
}

generateIcons().catch(console.error);
