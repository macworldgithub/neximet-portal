import { API_URL, getToken } from './api';

export type AIProvider = 'openai' | 'claude' | 'gemini';
export interface AIModel { id: string; name: string }
export interface AIConnection { provider: AIProvider; connected: boolean; defaultModel: string; models: AIModel[] }
export interface AIMessage {
  id: string;
  requestId: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'pending' | 'stopped' | 'error' | 'limited';
  errorMessage?: string;
  errorCode?: string;
  createdAt: string;
}
export interface AIConversationSummary { _id: string; title: string; provider: AIProvider; model: string; updatedAt: string }
export interface AIConversation extends AIConversationSummary { messages: AIMessage[]; generating: boolean }
export const aiProviders: { id: AIProvider; name: string; short: string; description: string; keyUrl: string }[] = [
  { id: 'openai', name: 'OpenAI GPT', short: 'GPT', description: 'Connect your OpenAI API account.', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'claude', name: 'Claude', short: 'Claude', description: 'Connect your Claude API account.', keyUrl: 'https://platform.claude.com/settings/keys' },
  { id: 'gemini', name: 'Gemini', short: 'Gemini', description: 'Connect your Google AI Studio API account.', keyUrl: 'https://aistudio.google.com/api-keys' },
];
export const emptyConnections: AIConnection[] = aiProviders.map(item => ({ provider: item.id, connected: false, defaultModel: '', models: [] }));
export const providerName = (provider: AIProvider) => aiProviders.find(item => item.id === provider)?.short || provider;
export const aiBillingUrl = (provider: AIProvider) => ({
  openai: 'https://platform.openai.com/settings/organization/billing',
  claude: 'https://platform.claude.com/settings/billing',
  gemini: 'https://aistudio.google.com/usage',
})[provider];
export const isAIBillingError = (code?: string) => code === 'ai_billing_required' || code === 'ai_spend_limit';
export const isAIQuotaError = (code?: string) => code === 'ai_quota_exhausted';

export type AIStreamEvent =
  | { type: 'start'; conversationId: string; title: string; userMessage: AIMessage; assistantMessage: AIMessage }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: AIMessage }
  | { type: 'error'; message: string; code?: string };

// Both the HTTP request and its response body share the caller's abort signal.
export async function streamAI(id: string, text: string, requestId: string, signal: AbortSignal, onEvent: (event: AIStreamEvent) => void) {
  const response = await fetch(`${API_URL}/ai/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
    body: JSON.stringify({ text, requestId }), signal, cache: 'no-store',
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || 'Unable to send this message. Please try again.');
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('The server could not open the reply stream.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', done = false;
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        const event = JSON.parse(data) as AIStreamEvent;
        if (event.type === 'done') done = true;
        onEvent(event);
      }
      if (chunk.done) break;
    }
    if (!done) throw new Error('The connection ended before the reply was confirmed. Reopen this chat to check its status.');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
