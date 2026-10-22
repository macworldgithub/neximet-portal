'use client';

import { useEffect, useRef, useState } from 'react';
import { applyMailTheme, mailDocument } from '../../lib/mailDocument';

export default function MailBody({ html, text, hasRemoteImages = false }: { html?: string; text?: string; hasRemoteImages?: boolean }) {
  const [externalImages, setExternalImages] = useState(false);
  const [height, setHeight] = useState(1);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return <section aria-label="Email message" className="my-5 overflow-hidden rounded-xl border border-[#1F293D] bg-[#111827] text-[#F3F4F6]">
    {hasRemoteImages && !externalImages && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F293D] bg-[#161F30] px-4 py-2 text-xs text-gray-400"><span>External images are hidden.</span><button type="button" className="font-medium text-[#5CC5FA] underline" onClick={() => setExternalImages(true)}>Show external images</button></div>}
    {html ? <iframe
      title="Formatted email message"
      srcDoc={mailDocument(html, externalImages)}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className="block w-full border-0 bg-[#111827]"
      style={{ height }}
      onLoad={event => {
        cleanup.current?.();
        const frame = event.currentTarget;
        const body = frame.contentDocument?.body;
        if (!body) return;
        applyMailTheme(frame.contentDocument!);
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
