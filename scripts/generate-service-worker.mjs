import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export async function generateServiceWorker(output = new URL('../public/sw-build.js', import.meta.url)) {
  const source = await readFile(new URL('../pwa/service-worker.js', import.meta.url), 'utf8');
  if (!source.includes('__NEXIMET_BUILD__')) throw new Error('Missing service-worker version marker');
  const version = randomUUID();
  await writeFile(output, source.replaceAll('__NEXIMET_BUILD__', version));
  // The prompt is shown once per installed release, without resetting browser
  // permissions or existing device subscriptions on every update.
  await writeFile(resolve(dirname(typeof output === 'string' ? output : fileURLToPath(output)), 'app-version.json'), JSON.stringify({ version }));
  return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateServiceWorker();
  console.log('Generated the Neximet service worker for this build.');
}
