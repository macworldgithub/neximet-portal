import { API_URL, apiFetch, apiPost } from './api';

export function supportsPush() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export async function bindPushAccount(userId: string, registration?: ServiceWorkerRegistration) {
  if (!supportsPush()) return;
  const worker = registration || await navigator.serviceWorker.getRegistration('/');
  if (!worker) return;
  (worker.active || worker.waiting)?.postMessage({ type: 'PUSH_ACCOUNT', userId, apiUrl: API_URL });
  const subscription = await worker.pushManager.getSubscription();
  if (subscription && Notification.permission === 'granted') await apiPost('/chat/push/subscriptions', subscription.toJSON());
}
export async function disablePush() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return;
  // Clear the account binding before network work, so late notifications cannot
  // expose the previous account's message after logout or an account switch.
  (registration.active || registration.waiting)?.postMessage({ type: 'CLEAR_PUSH_ACCOUNT' });
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await Promise.allSettled([
    apiFetch('/chat/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }), signal: AbortSignal.timeout(5000) }),
    subscription.unsubscribe(),
  ]);
}
export async function enablePush(userId: string, publicKey: string) {
  // Permission must be requested directly from the user's button click on iOS.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser or device settings.');
  let registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  await registration.update();
  if (registration.waiting) {
    const changed = new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    await Promise.race([changed, new Promise<void>((resolve) => setTimeout(resolve, 5000))]);
  }
  registration = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  const oldKey = subscription?.options.applicationServerKey;
  if (subscription && oldKey && btoa(String.fromCharCode(...new Uint8Array(oldKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== publicKey.replace(/=+$/, '')) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const result = await apiPost('/chat/push/subscriptions', subscription.toJSON());
  if (!result.success) { await subscription.unsubscribe(); throw new Error(result.message || 'Unable to register notifications'); }
  await bindPushAccount(userId, registration);
}
