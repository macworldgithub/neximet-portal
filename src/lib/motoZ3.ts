// Use the model, not the viewport: other phones share the Z3's screen size.
const motoZ3Model = /\b(?:moto|motorola)[ _-]+z(?:3|\(3\))(?=[\s;)/]|$)(?![ _-]+play\b)/i;

type DeviceNavigator = {
  userAgent: string;
  userAgentData?: {
    getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>;
  };
};

export async function isMotoZ3(device: DeviceNavigator): Promise<boolean> {
  if (motoZ3Model.test(device.userAgent)) return true;
  // Recent Chrome versions remove the model from the user agent string.
  try {
    const details = await device.userAgentData?.getHighEntropyValues?.(['model']);
    return motoZ3Model.test(details?.model ?? '');
  } catch {
    return false;
  }
}

export function openMotoZ3Drawer(menu: HTMLElement | null, onClose?: () => void) {
  const previous = document.activeElement as HTMLElement | null;
  const previousOverflow = document.body.style.overflow;
  const focus = (element: HTMLElement | null | undefined) => {
    try { element?.focus({ preventScroll: true }); }
    catch { element?.focus(); }
  };
  const resize = () => {
    // innerHeight also works on Android browsers without dynamic viewport units.
    menu?.style.setProperty('--moto-z3-height', `${window.innerHeight}px`);
    if (window.innerWidth >= 1024) onClose?.();
  };

  // Do not depend on MediaQueryList.addEventListener on older Android Chrome.
  window.addEventListener('resize', resize);
  resize();
  focus(menu?.querySelector<HTMLButtonElement>('button'));
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = previousOverflow;
    window.removeEventListener('resize', resize);
    menu?.style.removeProperty('--moto-z3-height');
    if (previous?.isConnected) focus(previous);
  };
}
