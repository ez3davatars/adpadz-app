async function registerServiceWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    await registration.update();
  } catch (error) {
    console.warn('AdPadz could not register its offline service worker.', error);
  }
}

async function unregisterDevelopmentServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const currentOrigin = window.location.origin;

  await Promise.all(
    registrations
      .filter(registration => new URL(registration.scope).origin === currentOrigin)
      .map(registration => registration.unregister()),
  );
}

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      void registerServiceWorker();
    }, { once: true });
  } else {
    void unregisterDevelopmentServiceWorkers().catch(error => {
      console.warn('AdPadz could not remove a development service worker.', error);
    });
  }
}
