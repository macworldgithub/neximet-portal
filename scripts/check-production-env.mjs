import nextEnv from '@next/env';
import { pathToFileURL } from 'node:url';

export function validatePublicURLs(env) {
  const api = new URL(env.NEXT_PUBLIC_API_URL || '');
  const base = new URL(env.NEXT_PUBLIC_BASE_URL || '');
  const local = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  for (const url of [api, base]) {
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local(url) && url.protocol === 'http:'))) throw new Error('Public backend URLs must use HTTPS (HTTP loopback is allowed for local tests) and contain no credentials, query strings or fragments.');
  }
  if (api.pathname !== '/api' || !['', '/'].includes(base.pathname) || api.origin !== base.origin) throw new Error('NEXT_PUBLIC_API_URL must end in /api; NEXT_PUBLIC_BASE_URL must be the same backend origin without a path.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  nextEnv.loadEnvConfig(process.cwd(), false);
  try { validatePublicURLs(process.env); console.log('Public production URLs validated.'); }
  catch (error) { console.error(`Frontend configuration error: ${error.message}\nSet NEXT_PUBLIC_API_URL and NEXT_PUBLIC_BASE_URL before building.`); process.exitCode = 1; }
}
