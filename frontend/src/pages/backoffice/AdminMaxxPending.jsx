import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, Send, Award, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMaxxPending() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/maxx-pending-by-user');
      setUsers(d.users || []);
    } catch (e) { toast.error(e?.message || 'Erro'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const sendUser = async (u) => {
    if (!u.linked) {
      toast.error('Usuário ainda não foi vinculado ao programa externo. Aguarde a sincronização ou edite o cadastro.');
      return;
    }
    if (!window.confirm(`Enviar ${u.points_total} pontos pendentes de ${u.user_name} ao programa externo?`)) return;
    setSendingId(u.user_id);
    try {
      const r = await api.post(`/api/admin/maxx-sync-user/${u.user_id}`);
      if (r.success) {
        toast.success(`${r.sent_count || 0} registros enviados com sucesso`);
      } else if (r.skipped) {
        toast.info(r.reason || 'Nada a enviar');
      } else {
        toast.error(r.error || 'Falha no envio');
      }
      await load();
    } catch (e) { toast.error(e?.message || 'Erro'); }
    finally { setSendingId(null); }
  };

  const totalPoints = users.reduce((s, u) => s + (u.points_total || 0), 0);
  const linkedCount = users.filter(u => u.linked).length;

  return (
    <div data-testid="admin-maxx-pending">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-black text-2xl text-txt-primary flex items-center gap-2">
            <Award className="w-6 h-6 text-brand-main" /> Pontos pendentes por usuário
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Usuários com pontos acumulados na OxxPharma ainda não enviados ao sistema externo.
            Após a vinculação por CPF, use o botão "Enviar pontos" para regularizar a situação manualmente.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Usuários com pendências" value={users.length} />
        <KpiCard label="Vinculados (prontos para envio)" value={linkedCount} hint={`${users.length - linkedCount} aguardando vínculo`} />
        <KpiCard label="Total de pontos pendentes" value={totalPoints.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-10 text-center text-sm text-txt-secondary">
          Nenhum usuário com pontos pendentes. Tudo em dia! 🎉
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr>
                <th className="text-left p-3">Usuário</th>
                <th className="text-left p-3">CPF</th>
                <th className="text-left p-3">External ID</th>
                <th className="text-center p-3">Registros</th>
                <th className="text-right p-3">Pontos</th>
                <th className="text-left p-3">Mais antigo</th>
                <th className="text-right p-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-t border-border hover:bg-bg-secondary/40">
                  <td className="p-3">
                    <div className="font-semibold">{u.user_name || '-'}</div>
                    <div className="text-xs text-txt-secondary">{u.user_email || '-'}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{u.cpf || '-'}</td>
                  <td className="p-3">
                    {u.user_external_id ? (
                      <Badge variant="success" data-testid={`linked-${u.user_id}`}>{u.user_external_id}</Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Sem vínculo
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center text-xs">{u.records_count}</td>
                  <td className="p-3 text-right font-bold">{(u.points_total || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                  <td className="p-3 text-xs text-txt-secondary">{u.oldest_at ? formatDateTime(u.oldest_at) : '-'}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link to={`/backoffice/usuarios/${u.user_id}`} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-bg-secondary text-txt-primary rounded hover:bg-border">
                        <Eye className="w-3 h-3" />
                      </Link>
                      <button
                        disabled={!u.linked || sendingId === u.user_id}
                        onClick={() => sendUser(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-brand-main text-white rounded hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed"
                        data-testid={`send-${u.user_id}`}
                      >
                        {sendingId === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Enviar pontos
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="text-xs font-semibold text-txt-secondary uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-heading font-black text-txt-primary">{value}</div>
      {hint && <div className="text-xs text-txt-secondary mt-1">{hint}</div>}
    </div>
  );
}
