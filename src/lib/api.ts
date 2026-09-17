export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('neximet_token');
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('neximet_token', token);
};

export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('neximet_token');
  localStorage.removeItem('neximet_user');
};

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; [key: string]: any }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json();

    if (!res.ok) {
      return {
        success: false,
        message: json.message || `Request failed with status ${res.status}`,
        ...json,
      };
    }

    return json;
  } catch (err: any) {
    console.error('API Error:', err);
    return {
      success: false,
      message: err.message || 'Network error occurred',
    };
  }
}

export const apiGet = <T = any>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' });

export const apiPost = <T = any>(endpoint: string, body?: any) =>
  apiFetch<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiPut = <T = any>(endpoint: string, body?: any) =>
  apiFetch<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T = any>(endpoint: string) =>
  apiFetch<T>(endpoint, { method: 'DELETE' });

export async function apiUpload<T = any>(
  endpoint: string,
  formData: FormData
): Promise<{ success: boolean; message?: string; [key: string]: any }> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Upload failed',
    };
  }
}
