// Regras de visibilidade de pontos por produto na loja.
// Controlado pelo admin em /backoffice/aparencia > aba "Pontos".
//
// Tokens em `points_visibility_audiences`:
//   'customer' | 'network_1' | 'network_2' | 'cat:{category_id}'
export function canSeeProductPoints(user, settings) {
  const mode = settings?.points_visibility_mode || 'none';
  if (mode === 'none') return false;
  if (mode === 'all') return true; // inclui visitantes não logados
  if (mode !== 'selected') return false;

  if (!user) return false;
  const audiences = settings?.points_visibility_audiences || [];
  if (!audiences.length) return false;

  const networkType = user.network_type || 'customer';
  if (audiences.includes(networkType)) return true;

  const userCats = user.category_ids || [];
  for (const token of audiences) {
    if (typeof token === 'string' && token.startsWith('cat:')) {
      const catId = token.slice(4);
      if (userCats.includes(catId)) return true;
    }
  }
  return false;
}

export function formatPointsLabel(points, suffix = 'pontos') {
  const n = Number(points) || 0;
  if (!n) return '';
  // Sem casas quando inteiro; 1 casa quando fracionado
  const formatted = Number.isInteger(n) ? n.toLocaleString('pt-BR') : n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${formatted} ${suffix}`;
}
