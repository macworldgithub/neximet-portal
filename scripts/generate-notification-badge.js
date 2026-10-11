const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');

async function generateNotificationBadge() {
  // Use the same emblem crop as generate-pwa-icons.js, without its opaque
  // app-icon backdrop. Android uses the alpha channel as the small-icon mask.
  const logo = await sharp(path.join(__dirname, '../public/neximet-logo.avif')).png().toBuffer();
  const crop = await sharp(logo)
    .extract({ left: 598, top: 0, width: 326, height: 453 })
    .png().toBuffer();
  const emblem = await sharp(crop).trim().png().toBuffer();
  const { data, info } = await sharp(emblem)
    .resize(80, 80, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    data[pixel] = 255;
    data[pixel + 1] = 255;
    data[pixel + 2] = 255;
  }
  const left = Math.floor((96 - info.width) / 2);
  const top = Math.floor((96 - info.height) / 2);
  const directory = path.join(__dirname, '../public/icons');
  await fs.mkdir(directory, { recursive: true });
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extend({ left, top, right: 96 - info.width - left, bottom: 96 - info.height - top, background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(directory, 'notification-badge-96x96.png'));
}

if (require.main === module) generateNotificationBadge()
  .then(() => console.log('Generated transparent Neximet notification badge (96×96).'))
  .catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = generateNotificationBadge;
