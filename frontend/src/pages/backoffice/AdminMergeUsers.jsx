import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../../lib/utils';
import {
  Loader2, Users, AlertTriangle, ShieldCheck, GitMerge, Eye,
  CheckCircle2, History, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const FIELD_LABELS = {
  cpf: 'CPF',
  email: 'E-mail',
  phone: 'Telefone',
};

export default function AdminMergeUsers() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [history, setHistory] = useState([]);
  const [confirming, setConfirming] = useState(null); // { group, keepId, dropId }
  const [merging, setMerging] = useState(false);
  const [tab, setTab] = useState('duplicates');

  const load = async () => {
    setLoading(true);
    try {
      const [d, h] = await Promise.all([
        api.get('/api/admin/duplicate-users'),
        api.get('/api/admin/merge-audit-log?limit=50').catch(() => ({ items: [] })),
      ]);
      setGroups(d.groups || []);
      setHistory(h.items || []);
    } catch (e) {
      toast.error('Falha ao carregar duplicatas: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const onConfirmMerge = async () => {
    if (!confirming) return;
    setMerging(true);
    try {
      const r = await api.post('/api/admin/merge-users', {
        keep_user_id: confirming.keepId,
        drop_user_id: confirming.dropId,
      });
      toast.success(`Fusão concluída. Conta ${confirming.dropId.slice(0, 8)}… absorvida.`);
      setConfirming(null);
      // Mostra o que moveu (debug) brevemente
      console.log('moved counts:', r.moved);
      await load();
    } catch (e) {
      toast.error('Falha na fusão: ' + (e.message || e));
    } finally {
      setMerging(false);
    }
  };

  return (
    <div data-testid="admin-merge-users">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-heading font-black text-2xl text-txt-primary flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-brand-main" /> Fusão de contas duplicadas
          </h1>
          <p className="text-sm text-txt-secondary mt-1 max-w-3xl">
            Cruzamos os usuários por <strong>CPF</strong>, <strong>e-mail</strong> e <strong>telefone</strong>. Quando há
            duplicidade (ex.: cliente cadastrado direto + mesmo CPF chegando da API Maxx), você pode fundir as contas.
            Os <strong>dados transacionais</strong> (pedidos, pontos, comissões, saques, cartão) da conta absorvida são
            preservados e migrados para a conta principal.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="reload-duplicates">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recarregar
        </Button>
      </div>

      {/* Avisos */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3" data-testid="merge-rules-banner">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <div className="font-bold mb-1">Regras da fusão</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>A conta <strong>principal (manter)</strong> permanece. A conta <strong>fundir</strong> é eliminada após mover relacionamentos.</li>
            <li>Dados <strong>cadastrais</strong> da conta &ldquo;fundir&rdquo; sobrescrevem os da principal <em>apenas se preenchidos</em> (campos vazios da Maxx nunca apagam dados existentes).</li>
            <li>Pedidos, pontos, comissões, saques, cartão de benefícios e relacionamentos de patrocinador são migrados para a conta principal.</li>
            <li>Toda fusão é registrada em log de auditoria.</li>
          </ul>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-5">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('duplicates')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === 'duplicates' ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid="tab-duplicates"
          >
            Duplicatas detectadas {groups.length > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-main text-white text-xs">{groups.length}</span>}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === 'history' ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}
            data-testid="tab-history"
          >
            Histórico de fusões {history.length > 0 && <span className="ml-1 text-xs text-txt-secondary">({history.length})</span>}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-main" />
        </div>
      ) : tab === 'duplicates' ? (
        groups.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-10 text-center" data-testid="no-duplicates">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <div className="font-heading font-black text-lg">Nenhuma duplicata encontrada</div>
            <div className="text-sm text-txt-secondary mt-1">
              Os usuários estão consistentes por CPF, e-mail e telefone.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g, i) => (
              <DuplicateGroup
                key={i}
                group={g}
                onMerge={(keepId, dropId) => setConfirming({ group: g, keepId, dropId })}
              />
            ))}
          </div>
        )
      ) : (
        <MergeHistory items={history} />
      )}

      {confirming && (
        <ConfirmMergeModal
          state={confirming}
          merging={merging}
          onCancel={() => setConfirming(null)}
          onConfirm={onConfirmMerge}
        />
      )}
    </div>
  );
}

function DuplicateGroup({ group, onMerge }) {
  // Estado local: qual user_id é o "manter" (default = suggested_keep)
  const [keepId, setKeepId] = useState(group.suggested_keep || group.users[0]?.user_id);
  // dropIds = outros (inicialmente todos os que não são keep ficam selecionados como drop)
  const [dropIds, setDropIds] = useState(
    group.users.filter(u => u.user_id !== (group.suggested_keep || group.users[0]?.user_id)).map(u => u.user_id)
  );

  const onSelectKeep = (uid) => {
    setKeepId(uid);
    // tira o keep dos drops e mantém os outros
    setDropIds(group.users.filter(u => u.user_id !== uid).map(u => u.user_id));
  };
  const toggleDrop = (uid) => {
    setDropIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  // Para o backend (1 a 1), fazemos merge sequencial: pega o primeiro drop selecionado.
  // O admin pode repetir o processo até que todos os drops sejam fundidos.
  const nextDrop = dropIds[0];

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden" data-testid="duplicate-group">
      <div className="px-4 py-3 bg-bg-secondary/60 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-brand-main" />
          <span className="text-sm font-bold">{group.users.length} contas com mesmo:</span>
          {group.match_fields.map(f => (
            <Badge key={f} variant="warning">{FIELD_LABELS[f] || f}</Badge>
          ))}
          <span className="text-xs font-mono text-txt-secondary truncate max-w-[260px]">
            valor: {group.match_value}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => nextDrop && onMerge(keepId, nextDrop)}
          disabled={!nextDrop || !keepId}
          data-testid="open-merge-confirm"
        >
          <GitMerge className="w-4 h-4" /> Fundir contas selecionadas
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white text-xs uppercase text-txt-secondary border-b border-border">
            <tr>
              <th className="text-left p-3 w-20">Manter</th>
              <th className="text-left p-3 w-20">Fundir</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Contato</th>
              <th className="text-left p-3">CPF / EXT</th>
              <th className="text-left p-3">Sinais</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {group.users.map(u => {
              const isKeep = u.user_id === keepId;
              const isDrop = dropIds.includes(u.user_id);
              return (
                <tr
                  key={u.user_id}
                  className={`border-t border-border ${isKeep ? 'bg-emerald-50/50' : isDrop ? 'bg-amber-50/30' : ''}`}
                  data-testid={`dup-row-${u.user_id}`}
                >
                  <td className="p-3">
                    <input
                      type="radio"
                      name={`keep-${group.match_value}`}
                      checked={isKeep}
                      onChange={() => onSelectKeep(u.user_id)}
                      data-testid={`keep-radio-${u.user_id}`}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={isDrop}
                      onChange={() => toggleDrop(u.user_id)}
                      disabled={isKeep}
                      data-testid={`drop-check-${u.user_id}`}
                    />
                  </td>
                  <td className="p-3 font-semibold">
                    {u.name || <span className="text-txt-secondary italic">(sem nome)</span>}
                    {u.created_at && (
                      <div className="text-[11px] font-normal text-txt-secondary">
                        cadastrado em {formatDateTime(u.created_at).split(' ')[0]}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <div>{u.email || '—'}</div>
                    <div className="text-txt-secondary">{u.phone || '—'}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <div>{u.cpf || '—'}</div>
                    {u.external_id && <div className="text-txt-secondary font-mono">EXT: {u.external_id}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    <div className="flex flex-col gap-0.5">
                      {u.has_orders && <Badge variant="success" className="w-fit">Tem pedidos</Badge>}
                      {u.has_points && <Badge variant="brand" className="w-fit">Tem pontos</Badge>}
                      {u.has_external_id && <Badge className="w-fit">Da API</Badge>}
                      {u.network_type && u.network_type !== 'customer' && <Badge variant="warning" className="w-fit">{u.network_type}</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <Link to={`/backoffice/usuarios/${u.user_id}`} target="_blank" className="text-xs text-brand-main hover:underline inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Ver
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dropIds.length > 1 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
          Você selecionou {dropIds.length} contas para fundir. A fusão é feita uma a uma — clique em &ldquo;Fundir&rdquo;
          repetidamente até concluir todas.
        </div>
      )}
    </div>
  );
}

function ConfirmMergeModal({ state, merging, onCancel, onConfirm }) {
  const { group, keepId, dropId } = state;
  const keep = group.users.find(u => u.user_id === keepId);
  const drop = group.users.find(u => u.user_id === dropId);
  if (!keep || !drop) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="confirm-merge-modal">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border">
          <h3 className="font-heading font-black text-xl flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-brand-main" /> Confirmar fusão de contas
          </h3>
          <p className="text-xs text-txt-secondary mt-1">
            Esta ação é <strong>irreversível</strong>. Releia atentamente antes de confirmar.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border border-emerald-300 bg-emerald-50 rounded-lg p-3">
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Conta principal (mantida)</div>
              <div className="font-bold">{keep.name || '(sem nome)'}</div>
              <div className="text-xs text-txt-secondary">{keep.email}</div>
              <div className="text-xs text-txt-secondary">{keep.phone || '—'}</div>
              <div className="text-[11px] font-mono mt-1 break-all">{keep.user_id}</div>
            </div>
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Conta a ser fundida (eliminada)</div>
              <div className="font-bold">{drop.name || '(sem nome)'}</div>
              <div className="text-xs text-txt-secondary">{drop.email}</div>
              <div className="text-xs text-txt-secondary">{drop.phone || '—'}</div>
              <div className="text-[11px] font-mono mt-1 break-all">{drop.user_id}</div>
            </div>
          </div>

          <div className="bg-bg-secondary border border-border rounded-lg p-3 text-xs">
            <div className="font-bold mb-1.5">Após a fusão:</div>
            <ul className="list-disc pl-4 space-y-1 text-txt-secondary">
              <li>Pedidos, pontos, comissões, saques e linhas de cartão da conta &ldquo;fundir&rdquo; serão migrados para a principal.</li>
              <li>Quem tinha a conta &ldquo;fundir&rdquo; como patrocinador/líder passa a apontar para a conta principal.</li>
              <li>Dados cadastrais (nome, e-mail, telefone, CPF, líder) serão sobrescritos com os da conta &ldquo;fundir&rdquo; <em>somente se preenchidos</em>.</li>
              <li>A conta &ldquo;fundir&rdquo; será deletada e a fusão ficará registrada em log de auditoria.</li>
            </ul>
          </div>
        </div>
        <div className="p-5 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={merging} data-testid="cancel-merge">
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={merging} data-testid="confirm-merge">
            {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar fusão
          </Button>
        </div>
      </div>
    </div>
  );
}

function MergeHistory({ items }) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-10 text-center" data-testid="no-merge-history">
        <History className="w-12 h-12 text-txt-secondary mx-auto mb-3 opacity-50" />
        <div className="font-heading font-black text-lg">Nenhuma fusão registrada</div>
        <div className="text-sm text-txt-secondary mt-1">As fusões manuais aparecerão aqui para auditoria.</div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-border rounded-xl overflow-x-auto" data-testid="merge-history-list">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
          <tr>
            <th className="text-left p-3">Data</th>
            <th className="text-left p-3">Mantido</th>
            <th className="text-left p-3">Fundido (deletado)</th>
            <th className="text-left p-3">Campos sobrescritos</th>
            <th className="text-left p-3">Realizado por</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.merge_id} className="border-t border-border">
              <td className="p-3 text-xs text-txt-secondary whitespace-nowrap">{it.performed_at ? formatDateTime(it.performed_at) : '-'}</td>
              <td className="p-3">
                <Link to={`/backoffice/usuarios/${it.kept_user_id}`} className="text-xs font-mono text-brand-main hover:underline">
                  {it.kept_user_id?.slice(0, 12)}…
                </Link>
              </td>
              <td className="p-3 text-xs font-mono text-txt-secondary">{it.deleted_user_id?.slice(0, 12)}…</td>
              <td className="p-3 text-xs">
                {(it.fields_overwritten || []).length === 0
                  ? <span className="text-txt-secondary">nenhum</span>
                  : (it.fields_overwritten || []).map(f => <Badge key={f} className="mr-1">{f}</Badge>)
                }
              </td>
              <td className="p-3 text-xs">{it.performed_by_email || it.performed_by_user_id || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
