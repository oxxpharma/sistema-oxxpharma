import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { MapPin, Loader2, Truck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'oxx_selected_shipping_v1';

export function loadSelectedShipping() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}
export function saveSelectedShipping(data) {
  if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  else localStorage.removeItem(STORAGE_KEY);
}

/**
 * Calculadora de frete reutilizável.
 * - Busca opções via /api/shipping/calculate
 * - Persiste a opção escolhida no localStorage (e via prop onSelect)
 * - Aceita `initialCep` e `readOnlyCep` (para uso no checkout quando o CEP vem do endereço)
 */
export default function ShippingCalculator({
  items,
  subtotal = 0,
  initialCep = '',
  readOnlyCep = false,
  onSelect,
  autoCalculate = false,
}) {
  const [cep, setCep] = useState(initialCep || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => loadSelectedShipping());
  const [lastCep, setLastCep] = useState('');

  const maskCep = (v) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

  const calculate = async (cepTarget) => {
    const target = (cepTarget || cep || '').replace(/\D/g, '');
    if (!target || target.length !== 8) { toast.error('Digite um CEP válido'); return; }
    setLoading(true);
    setError(null);
    try {
      const body = {
        cep_destination: target,
        items: (items || []).map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        subtotal,
      };
      const r = await api.post('/api/shipping/calculate', body);
      const opts = r.options || [];
      if (r.error) setError(r.error);
      if (!opts.length && !r.error) setError('Nenhuma opção disponível para este CEP.');
      // Normaliza shape (pode vir do Correios OU do Melhor Envio)
      const normalized = opts.map((o, idx) => ({
        id: o.service_id || o.code || `opt_${idx}`,
        name: o.service_name || o.name || 'Serviço',
        carrier: o.company_name || o.carrier || (o.provider === 'melhorenvio' ? '' : 'Correios'),
        price: Number(o.price || 0),
        original_price: Number(o.original_price || o.price || 0),
        free_shipping: !!o.free_shipping,
        free_shipping_label: o.free_shipping_label,
        delivery_days: o.delivery_days ?? o.delivery_time ?? o.prazo ?? null,
        logo: o.company_picture || null,
        provider: o.provider || null,
      }));
      setOptions(normalized);
      setLastCep(target);
      // Se tinha seleção antiga, revalida (o id ainda existe?)
      if (selected && !normalized.find(o => o.id === selected.id)) {
        setSelected(null);
        saveSelectedShipping(null);
        onSelect && onSelect(null);
      }
      // Auto-seleciona a primeira/mais barata se nada estava selecionado
      if (!selected && normalized.length) {
        const first = normalized[0];
        setSelected(first);
        saveSelectedShipping({ ...first, cep: target });
        onSelect && onSelect({ ...first, cep: target });
      }
    } catch (e) {
      setError(e?.message || 'Erro ao calcular frete');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (autoCalculate && initialCep && initialCep.replace(/\D/g, '').length === 8) {
      calculate(initialCep);
    }
    // eslint-disable-next-line
  }, [initialCep, autoCalculate]);

  const pick = (opt) => {
    setSelected(opt);
    const payload = { ...opt, cep: lastCep || cep.replace(/\D/g, '') };
    saveSelectedShipping(payload);
    onSelect && onSelect(payload);
  };

  return (
    <div className="space-y-3" data-testid="shipping-calculator">
      {!readOnlyCep && (
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary block mb-1.5 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Calcular frete</label>
          <div className="flex gap-2">
            <input
              value={cep}
              onChange={(e) => setCep(maskCep(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && calculate()}
              placeholder="00000-000"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-brand-main"
              data-testid="shipping-cep-input"
            />
            <button
              onClick={() => calculate()}
              disabled={loading}
              className="px-4 py-2 bg-brand-main text-white font-semibold text-sm rounded-lg hover:bg-brand-hover disabled:opacity-50"
              data-testid="shipping-calc-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calcular'}
            </button>
          </div>
          <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer" className="text-[11px] text-brand-main mt-1 inline-block">Não sei meu CEP</a>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-2 rounded">{error}</div>
      )}

      {options.length > 0 && (
        <div className="space-y-2">
          {options.map(opt => {
            const isSel = selected?.id === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => pick(opt)}
                className={`w-full text-left p-3 rounded-lg border-2 transition flex items-center gap-3 ${isSel ? 'border-brand-main bg-brand-light' : 'border-border hover:border-brand-main/40'}`}
                data-testid={`shipping-opt-${opt.id}`}
              >
                {opt.logo ? (
                  <img src={opt.logo} alt={opt.carrier} className="w-8 h-8 object-contain" />
                ) : (
                  <Truck className="w-6 h-6 text-brand-main" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-txt-primary">
                    {opt.carrier && <span className="text-txt-secondary">{opt.carrier} · </span>}
                    {opt.name}
                  </div>
                  {opt.delivery_days != null && (
                    <div className="text-[11px] text-txt-secondary">Entrega em até {opt.delivery_days} dia{opt.delivery_days === 1 ? '' : 's'} úteis</div>
                  )}
                </div>
                <div className="text-right">
                  {opt.free_shipping ? (
                    <>
                      <div className="text-xs text-txt-secondary line-through">{formatCurrency(opt.original_price)}</div>
                      <div className="font-heading font-black text-emerald-600">{opt.free_shipping_label || 'Grátis'}</div>
                    </>
                  ) : (
                    <div className="font-heading font-black text-txt-primary">{formatCurrency(opt.price)}</div>
                  )}
                </div>
                {isSel && <CheckCircle2 className="w-5 h-5 text-brand-main" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
