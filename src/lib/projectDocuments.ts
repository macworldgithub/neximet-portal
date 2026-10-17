import { BASE_URL, getToken } from './api';

export async function downloadScopeDocument(fileUrl: string, filename: string) {
  const token = getToken();
  if (!token) throw new Error('Sign in again before downloading this document.');
  if (!/^\/uploads\/scopes\/[a-z\d][a-z\d_.-]*$/i.test(fileUrl) || fileUrl.includes('..')) throw new Error('This document link is invalid.');
  const response = await fetch(`${BASE_URL}${fileUrl}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again before downloading this document.' : 'Document is unavailable or you do not have access.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = filename || 'project-document'; link.rel = 'noopener';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
