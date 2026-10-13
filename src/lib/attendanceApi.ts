import { apiFetch } from './api';

const options = () => ({ cache: 'no-store' as RequestCache, signal: AbortSignal.timeout(15000) });
export const attendanceGet = (endpoint: string) => apiFetch(endpoint, { ...options(), method: 'GET' });
export const attendancePost = (endpoint: string, body: unknown) => apiFetch(endpoint, { ...options(), method: 'POST', body: JSON.stringify(body) });
export const attendancePut = (endpoint: string, body: unknown) => apiFetch(endpoint, { ...options(), method: 'PUT', body: JSON.stringify(body) });
