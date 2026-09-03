import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const RefContext = createContext(null);
const REF_KEY = 'oxx_ref';                 // Iter 65: JSON { code, name, savedAt } com TTL
const REF_TTL_MS = 24 * 60 * 60 * 1000;    // 24h
// Chaves legadas — limpar se encontradas para migrar do formato antigo (sem TTL)
const LEGACY_REF_KEY = 'oxx_ref_code';
const LEGACY_REF_NAME_KEY = 'oxx_ref_name';

function loadStored() {
  // migra formato antigo (sem TTL) -> descarta
  if (localStorage.getItem(LEGACY_REF_KEY) || localStorage.getItem(LEGACY_REF_NAME_KEY)) {
    localStorage.removeItem(LEGACY_REF_KEY);
    localStorage.removeItem(LEGACY_REF_NAME_KEY);
  }
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.code || !obj.savedAt) return null;
    if (Date.now() - obj.savedAt > REF_TTL_MS) {
      localStorage.removeItem(REF_KEY);
      return null;
    }
    return obj;
  } catch {
    localStorage.removeItem(REF_KEY);
    return null;
  }
}

function persist(code, name) {
  localStorage.setItem(REF_KEY, JSON.stringify({ code, name: name || '', savedAt: Date.now() }));
}

export function RefProvider({ children }) {
  const { user } = useAuth();
  const [refCode, setRefCode] = useState(() => loadStored()?.code || null);
  const [refName, setRefName] = useState(() => loadStored()?.name || null);

  // Captura ?ref=XXX ao carregar a app (uma vez)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref');
    if (!code) return;
    const upper = code.trim().toUpperCase();
    (async () => {
      try {
        const resp = await api.get(`/api/referrals/validate/${upper}`);
        if (!resp.valid) return;
        // Iter 65: ignora se o proprio usuario esta tentando usar o proprio link
        if (resp.is_self) return;
        // Iter 65: ignora se o usuario ja tem outro indicador fixado — nao troca
        if (resp.already_sponsored) return;
        persist(resp.code, resp.affiliate_name || '');
        setRefCode(resp.code);
        setRefName(resp.affiliate_name || null);
      } catch { /* silencioso */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Iter 65: quando o usuario loga, revalida — se for auto-indicacao ou ja tem
  // sponsor diferente, limpa o cache para o banner sumir.
  useEffect(() => {
    if (!user || !refCode) return;
    if (user.referral_code && user.referral_code.toUpperCase() === refCode.toUpperCase()) {
      clearRef();
      return;
    }
    if (user.sponsor_code && user.sponsor_code.toUpperCase() !== refCode.toUpperCase()) {
      // usuario ja tem outro sponsor fixado — sobrepoe o cache com o sponsor real
      clearRef();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  // Iter 65: garante expiracao mesmo com aba aberta por muito tempo
  useEffect(() => {
    const t = setInterval(() => {
      const stored = loadStored();
      if (!stored && refCode) {
        setRefCode(null);
        setRefName(null);
      }
    }, 60 * 1000); // checa a cada minuto
    return () => clearInterval(t);
  }, [refCode]);

  const clearRef = () => {
    localStorage.removeItem(REF_KEY);
    localStorage.removeItem(LEGACY_REF_KEY);
    localStorage.removeItem(LEGACY_REF_NAME_KEY);
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
