import { useEffect, useState } from 'react';
import { api } from '../lib/api';

let cache = null;
let listeners = [];

function notify(s) {
  cache = s;
  listeners.forEach((fn) => fn(s));
}

export function refreshSiteSettings() {
  return api.get('/api/site-settings')
    .then((s) => { notify(s); return s; })
    .catch(() => null);
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(cache);

  useEffect(() => {
    listeners.push(setSettings);
    if (cache === null && listeners.length === 1) {
      api.get('/api/site-settings').then(notify).catch(() => {});
    } else if (cache) {
      setSettings(cache);
    }
    return () => { listeners = listeners.filter((fn) => fn !== setSettings); };
  }, []);

  return settings;
}
