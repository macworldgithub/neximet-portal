// Follow the visible viewport rather than imposing a minimum page height when
// iOS/Android opens the keyboard. Also handle Safari's viewport panning.
export function bindCommunicationViewport(root: HTMLElement, win: Window = window, doc: Document = document) {
  const viewport = win.visualViewport;
  const bodyOverflow = doc.body.style.overflow;
  const htmlOverflow = doc.documentElement.style.overflow;
  doc.body.style.overflow = 'hidden';
  doc.documentElement.style.overflow = 'hidden';
  let frame = 0;
  const update = () => {
    frame = 0;
    // Let pinch zoom and its native panning work without reflowing the app.
    if (viewport && viewport.scale !== 1) return;
    const chat = root.querySelector<HTMLElement>('[data-chat-scroll]');
    const atBottom = chat && chat.scrollHeight - chat.scrollTop - chat.clientHeight < 100;
    root.style.setProperty('--communication-height', `${viewport?.height || win.innerHeight}px`);
    root.style.setProperty('--communication-top', `${viewport?.offsetTop || 0}px`);
    // Preserve the latest visible messages as the keyboard changes pane height,
    // while leaving a person reading earlier history at their current position.
    if (chat && atBottom) chat.scrollTop = chat.scrollHeight;
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(update);
  };
  update();
  win.addEventListener('resize', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  return () => {
    win.cancelAnimationFrame(frame);
    win.removeEventListener('resize', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    root.style.removeProperty('--communication-height');
    root.style.removeProperty('--communication-top');
    doc.body.style.overflow = bodyOverflow;
    doc.documentElement.style.overflow = htmlOverflow;
  };
}
