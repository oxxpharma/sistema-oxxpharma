import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const STORAGE_KEY = 'oxx_site_settings_v1';

function getInitialCache() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

let cache = getInitialCache();
let listeners = [];
let inflightPromise = null;

function notify(s) {
  if (!s) return;
  cache = s;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }
  } catch (e) {}
  listeners.forEach((fn) => {
    try {
      fn(s);
    } catch (e) {}
  });
}

export function refreshSiteSettings() {
  inflightPromise = api.get('/api/site-settings')
    .then((s) => {
      notify(s);
      inflightPromise = null;
      return s;
    })
    .catch(() => {
      inflightPromise = null;
      return null;
    });
  return inflightPromise;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(cache);

  useEffect(() => {
    listeners.push(setSettings);

    // Se houver cache sincronizado após mount, atualiza
    if (cache && settings !== cache) {
      setSettings(cache);
    }

    // Busca em background para revalidar (stale-while-revalidate)
    if (!inflightPromise) {
      refreshSiteSettings();
    }

    return () => {
      listeners = listeners.filter((fn) => fn !== setSettings);
    };
  }, []);

  return settings;
}
