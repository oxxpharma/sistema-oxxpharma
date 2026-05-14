import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Loader2, X, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

/**
 * Modal de varredura na rede — exibe usuários com leader_external_id pendente,
 * separa em resolvíveis vs. não resolvíveis, permite seleção e aplica em massa.
 */
export default function ResolvePendingLeadersModal({ open, onClose, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showUnresolvable, setShowUnresolvable] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setData(null); setSelected(new Set()); setShowUnresolvable(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const r = await api.post('/api/admin/network/resolve-pending-leaders');
        setData(r);
        // Pré-seleciona todos os resolvíveis
        setSelected(new Set((r.resolvable || []).map(x => x.user_id)));
      } catch (e) {
        toast.error('Erro ao escanear: ' + (e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const toggle = (uid) => {
    const s = new Set(selected);
    if (s.has(uid)) s.delete(uid); else s.add(uid);
    setSelected(s);
  };
  const toggleAll = () => {
    if (!data?.resolvable) return;
    if (selected.size === data.resolvable.length) setSelected(new Set());
    else setSelected(new Set(data.resolvable.map(x => x.user_id)));
  };

  const onApply = async () => {
    if (selected.size === 0) return;
    setApplying(true);
    try {
      const r = await api.post('/api/admin/network/resolve-pending-leaders/apply', {
        user_ids: Array.from(selected),
      });
      toast.success(`${r.resolved} usuário(s) vinculado(s) · ${r.skipped} pulado(s)`, { duration: 7000 });
      if (onApplied) onApplied(r);
      onClose();
    } catch (e) {
      toast.error('Erro ao aplicar: ' + (e.message || e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="resolve-pending-modal">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-heading font-black text-xl">Varrer rede · vincular líderes pendentes</h2>
            <p className="text-xs text-txt-secondary mt-1">
              Mostra usuários que têm <code>leader_external_id</code> mas estão sem <code>network_sponsor_id</code> resolvido.
              Marque os que deseja vincular.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-bg-secondary rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>
          ) : !data ? (
            <div className="p-6 text-center text-txt-secondary text-sm">Nenhum dado.</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Verificados" value={data.scanned} color="text-txt-primary" />
                <Stat label="Resolvíveis agora" value={data.resolvable_count} color="text-emerald-700" />
                <Stat label="Sem líder na base" value={data.unresolvable_count} color="text-amber-700" />
              </div>

              {/* Lista de resolvíveis */}
              {data.resolvable.length > 0 ? (
                <div className="border border-emerald-200 rounded-lg overflow-hidden">
                  <div className="bg-emerald-50 px-4 py-2.5 flex items-center justify-between border-b border-emerald-200">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4" /> Prontos para vincular ({data.resolvable.length})
                    </div>
                    <button onClick={toggleAll} className="text-xs text-emerald-700 hover:underline" data-testid="toggle-all">
                      {selected.size === data.resolvable.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>
                  <ul className="divide-y divide-emerald-100 max-h-72 overflow-y-auto">
                    {data.resolvable.map(r => (
                      <li key={r.user_id} className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-emerald-50/40">
                        <input
                          type="checkbox"
                          checked={selected.has(r.user_id)}
                          onChange={() => toggle(r.user_id)}
                          className="mt-1 accent-emerald-600"
                          data-testid={`chk-${r.user_id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{r.name || '(sem nome)'}</div>
                          <div className="text-xs text-txt-secondary truncate">
                            EXT: {r.external_id || '—'} · líder EXT: {r.leader_external_id}
                          </div>
                          <div className="text-xs text-emerald-700 mt-0.5">
                            → vincular a: <strong>{r.leader?.name || r.leader?.email || r.leader?.user_id}</strong>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="border border-border rounded-lg p-6 text-center text-sm text-txt-secondary">
                  Nenhum vínculo pendente pode ser resolvido agora.
                </div>
              )}

              {/* Não-resolvíveis (colapsável) */}
              {data.unresolvable_count > 0 && (
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowUnresolvable(!showUnresolvable)}
                    className="w-full bg-amber-50 px-4 py-2.5 flex items-center justify-between text-sm font-semibold text-amber-800"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Sem líder na base ({data.unresolvable_count})
                    </span>
                    {showUnresolvable ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {showUnresolvable && (
                    <ul className="divide-y divide-amber-100 max-h-56 overflow-y-auto text-xs">
                      {data.unresolvable.map(r => (
                        <li key={r.user_id} className="px-4 py-2">
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-txt-secondary">EXT: {r.external_id || '—'} · esperando líder EXT: <strong>{r.leader_external_id}</strong></div>
                        </li>
                      ))}
                      {data.unresolvable.length > 100 && (
                        <li className="px-4 py-2 italic text-txt-secondary">Mostrando 100 primeiros…</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border p-4 flex items-center justify-between gap-3 bg-bg-secondary">
          <div className="text-sm text-txt-secondary">
            {selected.size > 0
              ? <><strong className="text-brand-main">{selected.size}</strong> selecionado(s) para vincular</>
              : 'Selecione ao menos um para aplicar'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={applying}>Cancelar</Button>
            <Button onClick={onApply} loading={applying} disabled={selected.size === 0 || loading} data-testid="apply-resolve-btn">
              Vincular selecionados
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-center">
      <div className={`font-heading font-black text-2xl ${color}`}>{value}</div>
      <div className="text-[11px] text-txt-secondary mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  );
}
