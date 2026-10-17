'use client';

import { useState } from 'react';
import { Check, ExternalLink, KeyRound, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { apiDelete, apiPut } from '../../lib/api';
import { aiBillingUrl, aiProviders, type AIConnection, type AIProvider } from '../../lib/ai';
import AIDialog from './AIDialog';

export const aiInput = 'w-full min-w-0 rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-[#5CC5FA] disabled:opacity-50';
export const aiButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#1F293D] bg-[#161F30] px-3 py-2 text-sm text-gray-200 hover:bg-[#1F293D] disabled:cursor-not-allowed disabled:opacity-40';

export default function AIConnections({ connections, serverConfigured, initialProvider, onChange, onClose }: { connections: AIConnection[]; serverConfigured: boolean; initialProvider: AIProvider; onChange: (connection: AIConnection) => void; onClose: () => void }) {
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const connection = connections.find(item => item.provider === provider)!;
  const info = aiProviders.find(item => item.id === provider)!;
  return <AIDialog title="AI connections" onClose={onClose} busy={busy}>
    <p className="text-sm leading-relaxed text-gray-400">Connect your own API accounts. API usage follows each provider’s pricing and limits, separately from regular chat subscriptions.</p>
    <div aria-label="AI provider" className="mt-5 flex gap-2">{aiProviders.map(item => <button key={item.id} type="button" disabled={busy} aria-pressed={provider === item.id} onClick={() => { setProvider(item.id); setKey(''); setError(''); setNotice(''); setConfirmDisconnect(false); }} className={`${aiButton} flex-1 ${provider === item.id ? 'border-[#5470F4] bg-[#5470F4]/15 text-[#5CC5FA]' : ''}`}>{item.short}{connections.find(c => c.provider === item.id)?.connected && <Check size={13} className="text-[#61CE70]" />}</button>)}</div>
    <div className="my-5 flex items-start gap-3"><span className="rounded-xl bg-[#5470F4]/15 p-2.5 text-[#5CC5FA]"><KeyRound size={20} /></span><div><h3 className="font-medium">{info.name}</h3><p className="mt-1 text-sm text-gray-400">{info.description}</p><a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm text-[#5CC5FA]">Get an API key<ExternalLink size={13} /></a></div></div>
    {provider === 'gemini' ? <div className="mb-5 rounded-xl border border-[#5470F4]/25 bg-[#5470F4]/5 p-4 text-sm leading-6 text-gray-300">
      <h4 className="font-medium text-gray-100">Use Gemini&apos;s free API allowance</h4>
      <p className="mt-1">Create a key in a Google AI Studio <strong>Free Tier</strong> project with no billing account linked, then choose a model with free-tier access. When its quota runs out, replies stop until the limit resets.</p>
      <p className="mt-2 text-xs text-gray-400">The API key&apos;s project determines whether usage is free or paid. This is separate from the allowance in the Gemini website.</p>
      <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[#5CC5FA]">Check free-tier models<ExternalLink size={13} /></a>
    </div> : <div className="mb-5 rounded-xl border border-[#1F293D] bg-[#0B0F19] p-4 text-sm leading-6 text-gray-400">
      <p>The free {provider === 'openai' ? 'ChatGPT' : 'Claude'} website allowance cannot be used through this API connection. For free chat inside Neximet, connect a Gemini Free Tier API key.</p>
      <a href={provider === 'openai' ? 'https://chatgpt.com' : 'https://claude.ai'} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[#5CC5FA]">Open {provider === 'openai' ? 'ChatGPT' : 'Claude'} on its website<ExternalLink size={13} /></a>
    </div>}
    {!serverConfigured && <p role="alert" className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">An administrator needs to configure the server encryption key before you can connect.</p>}
    {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mb-4 text-sm text-[#61CE70]">{notice}</p>}
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(''); setNotice('');
      const result = await apiPut(`/ai/connections/${provider}`, { apiKey: key || undefined });
      setBusy(false);
      if (result.success) { setKey(''); onChange(result.connection); setNotice('Connected. Model access is verified; replies also need available API credits or quota.'); }
      else setError(result.message || 'Unable to connect this provider.');
    }}>
      <label className="block text-sm text-gray-300">API key<input type="password" required={!connection.connected} value={key} disabled={busy || !serverConfigured} onChange={event => setKey(event.target.value)} maxLength={1024} autoComplete="new-password" spellCheck={false} className={`${aiInput} mt-2`} placeholder={connection.connected ? 'Leave blank to keep your saved key' : 'Paste your API key'} /></label>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">Your key is encrypted on the server and never shown again. Connecting checks model access without generating a reply. It does not verify your API credit balance.</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={busy || !serverConfigured} className={`${aiButton} border-[#5470F4] bg-[#5470F4] text-white hover:bg-[#435cd9]`}>{busy ? <Loader2 size={16} className="animate-spin" /> : connection.connected && !key ? <RefreshCw size={16} /> : <KeyRound size={16} />}{connection.connected && !key ? 'Refresh models' : 'Connect & verify'}</button>{connection.connected && <button type="button" disabled={busy} className={aiButton} onClick={() => setConfirmDisconnect(true)}><Unplug size={15} />Disconnect</button>}</div>
    </form>
    <a href={aiBillingUrl(provider)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-[#5CC5FA]">Check {info.short} API billing &amp; usage<ExternalLink size={13} /></a>
    {connection.connected && <div className="mt-5 border-t border-[#1F293D] pt-4"><p className="mb-2 text-sm text-gray-400">Default model for new chats</p><select aria-label="Default model" disabled={busy} className={aiInput} value={connection.defaultModel} onChange={async event => {
      setBusy(true); setError(''); setNotice('');
      const result = await apiPut(`/ai/connections/${provider}`, { defaultModel: event.target.value });
      setBusy(false);
      if (result.success) { onChange(result.connection); setNotice('Default model updated.'); } else setError(result.message || 'Could not update the model.');
    }}>{connection.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select><p className="mt-2 text-xs text-gray-500">{connection.models.length} models available. You can also choose a model when starting a chat.</p></div>}
    {confirmDisconnect && <div className="mt-5 rounded-xl border border-red-400/25 p-4 text-sm"><p>Disconnect {info.short}? Your saved conversations will remain here.</p><div className="mt-3 flex gap-2"><button disabled={busy} className={`${aiButton} text-red-300`} onClick={async () => {
      setBusy(true); setError('');
      const result = await apiDelete(`/ai/connections/${provider}`); setBusy(false);
      if (result.success) { onChange({ provider, connected: false, defaultModel: '', models: [] }); setConfirmDisconnect(false); setKey(''); setNotice('Provider disconnected.'); } else setError(result.message || 'Could not disconnect.');
    }}>Disconnect</button><button disabled={busy} className={aiButton} onClick={() => setConfirmDisconnect(false)}>Cancel</button></div></div>}
    <button type="button" disabled={busy} onClick={onClose} className={`${aiButton} mt-6 w-full`}>Done</button>
  </AIDialog>;
}
