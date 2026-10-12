/** Keep a deployment waiting until the user chooses to refresh their work. */
export function watchPwaUpdates(
  registration: ServiceWorkerRegistration,
  notify: () => void,
  reload: () => void,
) {
  let controller = navigator.serviceWorker.controller;
  let controllerChanged = false;
  let applying = false;
  const workers = new Set<ServiceWorker>();
  const checkWaiting = () => {
    if (registration.waiting && navigator.serviceWorker.controller) notify();
  };
  const watchInstalling = () => {
    const worker = registration.installing;
    if (!worker || workers.has(worker)) return;
    workers.add(worker);
    worker.addEventListener('statechange', checkWaiting);
  };
  const changed = () => {
    if (applying) { reload(); return; }
    // Another app window can activate an update. Offer this window a refresh
    // too, without automatically discarding a form or chat draft.
    if (controller && controller !== navigator.serviceWorker.controller) {
      controllerChanged = true;
      notify();
    }
    controller = navigator.serviceWorker.controller;
  };
  const checkForUpdate = () => {
    if (navigator.onLine && document.visibilityState === 'visible') {
      void registration.update().catch(() => {});
    }
  };
  registration.addEventListener('updatefound', watchInstalling);
  navigator.serviceWorker.addEventListener('controllerchange', changed);
  window.addEventListener('online', checkForUpdate);
  document.addEventListener('visibilitychange', checkForUpdate);
  const interval = window.setInterval(checkForUpdate, 60 * 60 * 1000);
  watchInstalling();
  checkWaiting();
  return {
    apply() {
      if (registration.waiting) {
        applying = true;
        registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      } else if (controllerChanged) reload();
    },
    dispose() {
      registration.removeEventListener('updatefound', watchInstalling);
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      window.removeEventListener('online', checkForUpdate);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.clearInterval(interval);
      workers.forEach((worker) => worker.removeEventListener('statechange', checkWaiting));
    },
  };
}
