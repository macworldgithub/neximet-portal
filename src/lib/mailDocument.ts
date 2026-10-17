export function mailDocument(html: string, externalImages = false) {
  // Both a sanitizer on the API and browser isolation protect the portal. Do not
  // add allow-scripts or move sender HTML into dangerouslySetInnerHTML.
  const policy = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:${externalImages ? ' https: http:' : ''}; font-src 'none'; media-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { color-scheme: light; }
    html { background: #fff; color: #111; }
    body { display: flow-root; box-sizing: border-box; margin: 0; padding: 20px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
    img { max-width: 100% !important; height: auto; }
    table { max-width: 100%; }
    a { color: #2563eb; }
    blockquote { margin: 0 0 0 16px; padding: 0; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; }
    ${externalImages ? '' : 'img[src^="http:"], img[src^="https:"] { display: none !important; }'}
    @media (max-width: 480px) { body { padding: 16px; } }
  </style></head><body>${html}</body></html>`;
}
