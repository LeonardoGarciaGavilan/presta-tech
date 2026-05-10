import { useState, useEffect } from 'react';

let injected = false;
let loadPromise = null;

const VERSION = '1.9.4';
const CSS_URL = `https://cdnjs.cloudflare.com/ajax/libs/leaflet/${VERSION}/leaflet.min.css`;
const JS_URL = `https://cdnjs.cloudflare.com/ajax/libs/leaflet/${VERSION}/leaflet.min.js`;

function injectLeaflet() {
  if (injected && window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('document not available'));
      return;
    }

    if (!document.getElementById('lf-css')) {
      const link = document.createElement('link');
      link.id = 'lf-css';
      link.rel = 'stylesheet';
      link.href = CSS_URL;
      document.head.appendChild(link);
    }

    if (window.L) {
      injected = true;
      resolve(window.L);
      return;
    }

    const existingScript = document.getElementById('lf-js');
    if (existingScript) {
      const poll = setInterval(() => {
        if (window.L) {
          clearInterval(poll);
          injected = true;
          resolve(window.L);
        }
      }, 80);
    } else {
      const script = document.createElement('script');
      script.id = 'lf-js';
      script.src = JS_URL;
      script.onload = () => {
        injected = true;
        resolve(window.L);
      };
      script.onerror = () => {
        loadPromise = null;
        reject(new Error('Error al cargar Leaflet'));
      };
      document.head.appendChild(script);
    }
  });

  return loadPromise;
}

export default function useLeaflet() {
  const [state, setState] = useState({ L: null, ready: false, error: null });

  useEffect(() => {
    let cancelled = false;

    injectLeaflet()
      .then(L => {
        if (!cancelled) setState({ L, ready: true, error: null });
      })
      .catch(err => {
        if (!cancelled) setState({ L: null, ready: false, error: err });
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
