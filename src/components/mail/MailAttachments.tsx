'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { MailAttachment } from '../../lib/mail';

function ImagePreview({ attachment }: { attachment: MailAttachment }) {
  const [failed, setFailed] = useState(false);
  const preview = attachment.preview;
  return <figure className="overflow-hidden rounded-xl border border-[#29344a] bg-[#0B0F19]">
    {preview && !failed ? <Image
      src={preview.dataUrl}
      alt={attachment.filename}
      width={preview.width}
      height={preview.height}
      unoptimized
      className="max-h-[32rem] h-auto w-full object-contain"
      onError={() => setFailed(true)}
    /> : <p className="p-4 text-sm text-gray-400">Preview unavailable. Open this image in Hostinger webmail.</p>}
    <figcaption className="break-all border-t border-[#29344a] px-3 py-2 text-xs text-gray-400">
      {attachment.filename} ({Math.ceil(attachment.size / 1024)} KB)
      {attachment.inline && <span className="ml-2 text-gray-500">Embedded image</span>}
    </figcaption>
  </figure>;
}

export default function MailAttachments({ attachments }: { attachments: MailAttachment[] }) {
  if (!attachments.length) return null;
  const images = attachments.filter(item => item.isImage || item.preview);
  const files = attachments.filter(item => !item.isImage && !item.preview);
  return <section aria-label="Email attachments" className="mb-5 space-y-3">
    {!!images.length && <>
      <h3 className="text-sm font-medium text-gray-200">Images ({images.length})</h3>
      {images.map((attachment, index) => <ImagePreview key={index} attachment={attachment} />)}
    </>}
    {!!files.length && <div className="rounded-xl border border-[#29344a] p-3 text-xs text-gray-400">
      <h3 className="font-medium text-gray-200">Attachments</h3>
      {files.map((attachment, index) => <p key={index} className="mt-1 break-all">{attachment.filename} ({Math.ceil(attachment.size / 1024)} KB)</p>)}
    </div>}
    <a href="https://mail.hostinger.com" target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-[#5CC5FA] underline">Open Hostinger webmail to download original attachments</a>
  </section>;
}
