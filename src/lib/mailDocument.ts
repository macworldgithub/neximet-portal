export function applyMailTheme(document: Document) {
  // Inline !important colors in sender HTML can otherwise override the theme.
  // Change colors only: keep the sender's spacing, typography and image pixels.
  document.body.style.setProperty('background-color', '#111827', 'important');
  document.body.style.setProperty('color', '#F3F4F6', 'important');
  document.body.querySelectorAll<HTMLElement>('*:not(img)').forEach(element => {
    element.style.setProperty('color', element.tagName === 'A' ? '#5CC5FA' : 'inherit', 'important');
    element.style.setProperty('background-color', 'transparent', 'important');
    element.style.setProperty('border-color', '#1F293D', 'important');
  });
}

export function mailDocument(html: string, externalImages = false) {
  // Both a sanitizer on the API and browser isolation protect the portal. Do not
  // add allow-scripts or move sender HTML into dangerouslySetInnerHTML.
  const policy = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:${externalImages ? ' https: http:' : ''}; font-src 'none'; media-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { color-scheme: dark; }
    html { background: #111827 !important; color: #F3F4F6 !important; }
    body { display: flow-root; box-sizing: border-box; margin: 0; padding: 20px 24px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; background: #111827 !important; color: #F3F4F6 !important; }
    body *:not(img) { color: inherit !important; background-color: transparent !important; border-color: #1F293D !important; }
    img { max-width: 100% !important; height: auto; }
    table { max-width: 100%; }
    body a, body a * { color: #5CC5FA !important; }
    blockquote { margin: 0 0 0 16px; padding: 0; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; }
    ${externalImages ? '' : 'img[src^="http:"], img[src^="https:"] { display: none !important; }'}
    @media (max-width: 480px) { body { padding: 16px; } }
  </style></head><body>${html}</body></html>`;
}
