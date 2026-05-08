/**
 * Iter 42h: helper de avaliacao de frete gratis no frontend.
 * Espelha o backend (_evaluate_free_shipping em server.py).
 *
 * Suporta os 2 schemas:
 *   - NOVO: settings.free_shipping_rules = [ {rule}, ... ]
 *   - LEGADO: free_shipping_mode + min_subtotal + audiences
 *
 * Quando rules existe e nao-vazio, prevalece sobre legado.
 *
 * Retorna: { applies: bool, threshold: number, remaining: number, matchedRule: string|null }
 */
export function evaluateFreeShipping(settings, user, subtotal) {
  if (!settings) return { applies: false };
  if (settings.free_shipping_enabled === false) {
    return { applies: false };
  }
  const sub = Number(subtotal || 0);
  const rules = settings.free_shipping_rules || [];

  if (rules.length > 0) {
    for (const r of rules) {
      if (matchesRule(user, r, sub)) {
        return { applies: true, matchedRule: r.name || 'regra' };
      }
    }
    // Nenhuma casou: pegar a regra com menor min_subtotal para mostrar barra de progresso
    const thresholds = rules
      .map(r => Number(r.min_subtotal || 0))
      .filter(t => t > 0);
    if (thresholds.length > 0) {
      const minT = Math.min(...thresholds);
      return { applies: false, threshold: minT, remaining: Math.max(0, minT - sub) };
    }
    return { applies: false };
  }

  // Schema legado
  const mode = (settings.free_shipping_mode || 'off').toLowerCase();
  const fsMin = Number(settings.free_shipping_min_subtotal || 0);
  const audiences = settings.free_shipping_audiences || [];

  if (mode === 'all') return { applies: true, matchedRule: 'all' };
  if (mode === 'above' && fsMin > 0 && sub >= fsMin) {
    return { applies: true, matchedRule: 'above' };
  }
  if (mode === 'audiences') {
    const userMatches = userMatchesAudiences(user, audiences);
    if (userMatches && (fsMin <= 0 || sub >= fsMin)) {
      return { applies: true, matchedRule: 'audiences' };
    }
  }
  if (mode === 'above' && fsMin > 0) {
    return { applies: false, threshold: fsMin, remaining: Math.max(0, fsMin - sub) };
  }
  return { applies: false };
}

function matchesRule(user, rule, subtotal) {
  const accountTypes = rule.account_types || [];
  const categories = rule.categories || [];
  const minSub = Number(rule.min_subtotal || 0);

  if (minSub > 0 && subtotal < minSub) return false;

  // Sem criterios de publico = match universal
  if (accountTypes.length === 0 && categories.length === 0) return true;

  if (!user) return false;
  const ntype = user.network_type || 'customer';
  if (accountTypes.includes(ntype)) return true;
  if (categories.length > 0) {
    const ucats = user.category_ids || [];
    for (const c of categories) {
      if (ucats.includes(c)) return true;
    }
  }
  return false;
}

function userMatchesAudiences(user, audiences) {
  if (!audiences || audiences.length === 0 || !user) return false;
  const ntype = user.network_type || 'customer';
  if (audiences.includes(ntype)) return true;
  const ucats = user.category_ids || [];
  for (const tok of audiences) {
    if (typeof tok === 'string' && tok.startsWith('cat:') && ucats.includes(tok.slice(4))) {
      return true;
    }
  }
  return false;
}
