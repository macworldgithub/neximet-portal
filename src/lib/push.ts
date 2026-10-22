import { API_URL, apiFetch, apiPost, getToken } from './api';

function currentAccount(token: string | null, userId: string) {
  try {
    if (!token || token !== getToken()) return false;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.id === userId;
  } catch { return false; }
}

export function supportsPush() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export async function closeCallNotification(callId: string) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    (registration?.active || registration?.waiting)?.postMessage({ type: 'CLOSE_CALL_NOTIFICATION', callId });
  } catch { /* Notifications are optional; calling must continue without them. */ }
}
export async function bindPushAccount(userId: string, registration?: ServiceWorkerRegistration) {
  if (!supportsPush()) return;
  try { if (localStorage.getItem(`neximet-device-notifications:${userId}`) === 'off') return; } catch { /* Storage is optional. */ }
  const token = getToken();
  const worker = registration || await navigator.serviceWorker.getRegistration('/');
  if (!worker || !currentAccount(token, userId)) return;
  (worker.active || worker.waiting)?.postMessage({ type: 'PUSH_ACCOUNT', userId, apiUrl: API_URL });
  const subscription = await worker.pushManager.getSubscription();
  if (subscription && Notification.permission === 'granted' && currentAccount(token, userId)) {
    const result = await apiPost('/chat/push/subscriptions', subscription.toJSON());
    if (!result.success) throw new Error(result.message || 'Unable to register this device.');
  }
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
  if (!supportsPush()) throw new Error('Install the app in a browser that supports notifications.');
  const token = getToken();
  if (!currentAccount(token, userId)) throw new Error('Your account changed. Please try again.');
  // Permission must be requested directly from the user's button click on iOS.
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser or device settings.');
  if (!currentAccount(token, userId)) throw new Error('Your account changed. Please try again.');
  await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  // Let the existing update UI activate waiting workers after active work ends.
  // Enabling notifications must never reload an ongoing call.
  let timer: ReturnType<typeof setTimeout>;
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Notifications could not start. Please reconnect and try again.')), 15000); })]).finally(() => clearTimeout(timer));
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  const oldKey = subscription?.options.applicationServerKey;
  if (subscription && oldKey && btoa(String.fromCharCode(...new Uint8Array(oldKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== publicKey.replace(/=+$/, '')) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  if (!currentAccount(token, userId)) { await subscription.unsubscribe(); throw new Error('Your account changed. Please try again.'); }
  const result = await apiPost('/chat/push/subscriptions', subscription.toJSON());
  if (!result.success) { await subscription.unsubscribe(); throw new Error(result.message || 'Unable to register notifications'); }
  if (!currentAccount(token, userId)) { await subscription.unsubscribe(); throw new Error('Your account changed. Please try again.'); }
  (registration.active || registration.waiting)?.postMessage({ type: 'PUSH_ACCOUNT', userId, apiUrl: API_URL });
}
