'use client';

import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return <div className="ai-code-block my-4 min-w-0 overflow-hidden rounded-xl border border-[#1F293D] bg-[#080D17]">
    <div className="flex items-center justify-between border-b border-[#1F293D] bg-[#111827] px-3 py-1 text-xs text-gray-400"><span>Code</span><button className="flex min-h-9 items-center gap-1.5 rounded px-2 hover:text-white" onClick={async event => {
      const text = event.currentTarget.closest('.ai-code-block')?.querySelector('pre')?.textContent || '';
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
    }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy code'}</button></div>
    <pre className="overflow-x-auto p-4 text-[13px] leading-6">{children}</pre>
  </div>;
}

export default function AIMessageBody({ text }: { text: string }) {
  return <div className="ai-markdown min-w-0 text-[15px] leading-7 text-gray-200"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    // Replies cannot silently load remote images or tracking pixels.
    img: ({ alt, src }) => typeof src === 'string' && /^https?:\/\//i.test(src) ? <a href={src} target="_blank" rel="noopener noreferrer">{alt || 'View image'}</a> : <span>{alt || 'Image'}</span>,
    table: ({ children }) => <div className="my-4 max-w-full overflow-x-auto"><table>{children}</table></div>,
  }}>{text}</Markdown></div>;
}
