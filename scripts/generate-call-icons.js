const path = require('node:path');
const sharp = require('sharp');
const phone = '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.08 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92z"/>';
async function generate() {
  const directory = path.join(__dirname, '../public/icons');
  const svg = (size, background) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${background ? '<rect width="32" height="32" rx="8" fill="#111827"/><circle cx="16" cy="16" r="13" fill="#059669"/>' : ''}<g transform="translate(6 6) scale(.83)" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${phone}</g></svg>`);
  await sharp(svg(192, true)).png().toFile(path.join(directory, 'call-192x192.png'));
  await sharp(svg(96, false)).png().toFile(path.join(directory, 'call-badge-96x96.png'));
}
if (require.main === module) generate().then(() => console.log('Generated call notification icons.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = generate;
