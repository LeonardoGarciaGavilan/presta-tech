import { useEffect, useRef } from 'react';

export default function useSWUpdate() {
  const pendingUpdate = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pendingUpdate.current) {
        window.location.reload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const checkUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const onStateChange = () => {
            if (registration.installing?.state === 'installed' && navigator.serviceWorker.controller) {
              pendingUpdate.current = true;
            }
          };

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  pendingUpdate.current = true;
                }
              });
            }
          });

          if (registration.installing) {
            registration.installing.addEventListener('statechange', onStateChange);
          }
        }
      } catch (err) {
        console.error('SW Update check error:', err);
      }
    };

    checkUpdate();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
