import { API_URL, getToken } from './api';
import type { ChatMessage } from './chat';

export function uploadChatMessage(chatId: string, clientId: string, text: string, files: File[], onProgress: (percent: number) => void): Promise<{ success: boolean; message: ChatMessage }> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('text', text); body.append('clientId', clientId);
    files.forEach(file => body.append('attachment', file));
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}/chat/conversations/${chatId}/messages`);
    request.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    request.responseType = 'json';
    request.timeout = 5 * 60 * 1000;
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300 && request.response?.success) resolve(request.response);
      else reject(new Error(typeof request.response?.message === 'string' ? request.response.message : request.status === 413 ? 'The server rejected this upload size. Please contact your administrator.' : 'Message could not be sent'));
    };
    request.onerror = () => reject(new Error('Upload interrupted. Check your connection and retry.'));
    request.ontimeout = () => reject(new Error('Upload timed out. Please retry.'));
    request.onabort = () => reject(new Error('Upload was cancelled. Please retry.'));
    request.send(body);
  });
}
