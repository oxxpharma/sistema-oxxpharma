import { useEffect, useState } from 'react';
import { api } from '../lib/api';

let cache = null;
let listeners = [];

export function useSiteSettings() {
  const [settings, setSettings] = useState(cache);

  useEffect(() => {
    if (cache) return;
    listeners.push(setSettings);
    if (listeners.length === 1) {
      api.get('/api/site-settings').then((s) => {
        cache = s;
        listeners.forEach((fn) => fn(s));
      }).catch(() => {});
    }
    return () => { listeners = listeners.filter((fn) => fn !== setSettings); };
  }, []);

  return settings;
}
