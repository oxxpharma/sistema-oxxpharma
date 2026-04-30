import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import { Check, X, Loader2, UserCheck, AlertTriangle, Clock } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

export default function AdminReferralEnrollments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/referral-enrollments/pending');
      setItems(r.items || []);
    } catch (e) { toast.error(e?.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const approve = async (u) => {
    if (!window.confirm(`Aprovar adesão de ${u.name} ao programa de indicação?`)) return;
    setBusy(u.user_id);
    try {
      const r = await api.post(`/api/admin/users/${u.user_id}/approve-referral-enrollment`);
      toast.success(`Aprovado. Código: ${r.referral_code}`);
      load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
    finally { setBusy(null); }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.user_id);
    try {
      await api.post(`/api/admin/users/${rejecting.user_id}/reject-referral-enrollment`, { reason });
      toast.success('Adesão rejeitada');
      setRejecting(null);
      setReason('');
      load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
    finally { setBusy(null); }
  };

  return (
    <div data-testid="admin-referral-enrollments">
      <div className="mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
          <UserCheck className="w-7 h-7 text-brand-main" /> Adesões pendentes
        </h1>
        <p className="text-sm text-txt-secondary mt-1">Solicitações de inscrição no programa de indicação aguardando sua aprovação.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-7 h-7 animate-spin text-brand-main mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <Clock className="w-10 h-10 text-txt-secondary mx-auto mb-3" />
          <div className="text-sm text-txt-secondary">Nenhuma solicitação pendente no momento.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(u => (
            <div key={u.user_id} className="bg-white border border-border rounded-xl p-5" data-testid={`enrollment-${u.user_id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">{u.name}</h3>
                    <Badge variant="warning"><Clock className="w-3 h-3" /> Pendente</Badge>
                  </div>
                  <div className="text-xs text-txt-secondary mt-1">{u.email} · {u.phone || 'sem telefone'}</div>
                  {u.referral_enrollment_submitted_at && (
                    <div className="text-xs text-txt-secondary mt-1">Solicitado em {formatDateTime(u.referral_enrollment_submitted_at)}</div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button onClick={() => approve(u)} disabled={busy === u.user_id} data-testid={`approve-${u.user_id}`} size="sm">
                    {busy === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Aprovar
                  </Button>
                  <Button variant="outline" onClick={() => setRejecting(u)} size="sm" data-testid={`reject-${u.user_id}`}>
                    <X className="w-3 h-3" /> Rejeitar
                  </Button>
                </div>
              </div>
              {u.referral_enrollment && Object.keys(u.referral_enrollment).length > 0 && (
                <details className="mt-3 group">
                  <summary className="cursor-pointer text-xs font-bold text-brand-main hover:underline">Ver dados enviados</summary>
                  <div className="mt-2 p-3 bg-bg-secondary/60 rounded-lg text-xs space-y-1">
                    {Object.entries(u.referral_enrollment).map(([k, v]) => (
                      <div key={k}>
                        <span className="font-mono text-txt-secondary">{k}:</span>{' '}
                        <span className="font-medium">{String(v ?? '-')}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !busy && setRejecting(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Rejeitar adesão</h3>
            <p className="text-sm text-txt-secondary mt-2">Você está rejeitando a adesão de <b>{rejecting.name}</b>. O usuário será notificado por e-mail.</p>
            <textarea className="w-full mt-3 px-3 py-2 border border-border rounded-lg text-sm" rows={3} placeholder="Motivo (opcional)" value={reason} onChange={e => setReason(e.target.value)} data-testid="reject-reason" />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setRejecting(null)} disabled={!!busy}>Cancelar</Button>
              <Button onClick={reject} disabled={!!busy} data-testid="reject-confirm">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Confirmar rejeição
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
