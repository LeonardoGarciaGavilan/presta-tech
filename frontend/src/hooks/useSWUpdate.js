import { useState, useEffect } from 'react';

export default function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          setRegistration(registration);
          
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });

          if (registration.installing) {
            registration.installing.addEventListener('statechange', (e) => {
              if (e.target.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        }
      } catch (err) {
        console.error('SW Update check error:', err);
      }
    };

    checkUpdate();
  }, []);

  const updateApp = async () => {
    if (!registration) return false;

    try {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
      return true;
    } catch (err) {
      console.error('Update error:', err);
      return false;
    }
  };

  return {
    updateAvailable,
    updateApp
  };
}
