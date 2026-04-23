import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const RefContext = createContext(null);
const REF_KEY = 'oxx_ref_code';
const REF_NAME_KEY = 'oxx_ref_name';

export function RefProvider({ children }) {
  const [refCode, setRefCode] = useState(() => localStorage.getItem(REF_KEY) || null);
  const [refName, setRefName] = useState(() => localStorage.getItem(REF_NAME_KEY) || null);

  useEffect(() => {
    // Capturar ?ref=XXX da URL ao carregar
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref');
    if (code && code !== refCode) {
      const upper = code.trim().toUpperCase();
      (async () => {
        try {
          const resp = await api.get(`/api/referrals/validate/${upper}`);
          if (resp.valid) {
            localStorage.setItem(REF_KEY, resp.code);
            localStorage.setItem(REF_NAME_KEY, resp.affiliate_name || '');
            setRefCode(resp.code);
            setRefName(resp.affiliate_name || null);
          }
        } catch {}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearRef = () => {
    localStorage.removeItem(REF_KEY);
    localStorage.removeItem(REF_NAME_KEY);
    setRefCode(null);
    setRefName(null);
  };

  return (
    <RefContext.Provider value={{ refCode, refName, clearRef, setRefCode, setRefName }}>
      {children}
    </RefContext.Provider>
  );
}

export function useReferral() {
  const ctx = useContext(RefContext);
  if (!ctx) throw new Error('useReferral must be used within RefProvider');
  return ctx;
}
