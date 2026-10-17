'use client';

import { useEffect, useRef, useState } from 'react';
import { mailDocument } from '../../lib/mailDocument';

export default function MailBody({ html, text, hasRemoteImages = false }: { html?: string; text?: string; hasRemoteImages?: boolean }) {
  const [externalImages, setExternalImages] = useState(false);
  const [height, setHeight] = useState(1);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return <section aria-label="Email message" className="my-5 overflow-hidden rounded-lg border border-[#29344a] bg-white text-[#111]">
    {hasRemoteImages && !externalImages && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600"><span>External images are hidden.</span><button className="font-medium text-blue-600 underline" onClick={() => setExternalImages(true)}>Show external images</button></div>}
    {html ? <iframe
      title="Formatted email message"
      srcDoc={mailDocument(html, externalImages)}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className="block w-full border-0 bg-white"
      style={{ height }}
      onLoad={event => {
        cleanup.current?.();
        const frame = event.currentTarget;
        const body = frame.contentDocument?.body;
        if (!body) return;
        const measure = () => setHeight(Math.max(1, Math.ceil(body.scrollHeight)));
        const observer = new ResizeObserver(measure);
        observer.observe(body);
        body.addEventListener('load', measure, true);
        measure();
        cleanup.current = () => { observer.disconnect(); body.removeEventListener('load', measure, true); };
      }}
    /> : <div className="whitespace-pre-wrap break-words px-4 py-5 text-[16px] leading-6 [overflow-wrap:anywhere]">{text || 'This message has no text content.'}</div>}
  </section>;
}
