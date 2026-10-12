import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function generateServiceWorker(output = new URL('../public/sw-build.js', import.meta.url)) {
  const source = await readFile(new URL('../pwa/service-worker.js', import.meta.url), 'utf8');
  if (!source.includes('__NEXIMET_BUILD__')) throw new Error('Missing service-worker version marker');
  const version = randomUUID();
  await writeFile(output, source.replaceAll('__NEXIMET_BUILD__', version));
  return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateServiceWorker();
  console.log('Generated the Neximet service worker for this build.');
}
