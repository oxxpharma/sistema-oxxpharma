import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  Shield, Upload, Loader2, AlertTriangle, CheckCircle2, XCircle, HelpCircle,
  Undo2, Trash2, ArrowRight, RefreshCw, FileSpreadsheet, Search,
} from 'lucide-react';

const STATUS_LABEL = {
  draft: { label: 'Rascunho', variant: 'warning' },
  applied: { label: 'Aplicado', variant: 'success' },
  reverted: { label: 'Revertido', variant: 'secondary' },
};

const MATCH_LABEL = {
  matched: { label: 'Encontrado', variant: 'success', icon: CheckCircle2 },
  not_found: { label: 'Não encontrado', variant: 'secondary', icon: HelpCircle },
  already_cancelled: { label: 'Já cancelado', variant: 'warning', icon: AlertTriangle },
  email_ambiguous: { label: 'E-mail ambíguo', variant: 'danger', icon: XCircle },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
}

function defaultRefMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminNetworkSuppression() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [refMonth, setRefMonth] = useState(defaultRefMonth());
  const [uploading, setUploading] = useState(false);
  const [openBatchId, setOpenBatchId] = useState(null);
  const [openBatch, setOpenBatch] = useState(null); // { batch, entries }
  const [tab, setTab] = useState('matched');
  const [search, setSearch] = useState('');
  const [applying, setApplying] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/network-suppression/batches?limit=60');
      setBatches(r.items || []);
    } catch (err) { toast.error(err.message || 'Erro carregando lotes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const openBatchDetail = async (batch_id) => {
    setOpenBatchId(batch_id);
    setOpenBatch(null); setTab('matched'); setSearch('');
    try {
      const r = await api.get(`/api/admin/network-suppression/batches/${batch_id}`);
      setOpenBatch(r);
    } catch (err) {
      toast.error(err.message || 'Erro carregando detalhe');
      setOpenBatchId(null);
    }
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Selecione um arquivo .xls ou .xlsx'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('reference_month', refMonth);
      const r = await api.post('/api/admin/network-suppression/upload', fd);
      toast.success(`Preview criado: ${r.summary.matched} match, ${r.summary.not_found} não encontrado`);
      setFile(null);
      await loadBatches();
      await openBatchDetail(r.batch_id);
      const el = document.getElementById('ns-file-input');
      if (el) el.value = '';
    } catch (err) { toast.error(err.message || 'Erro no upload'); }
    finally { setUploading(false); }
  };

  const doApply = async () => {
    if (!openBatch) return;
    setApplying(true);
    try {
      const r = await api.post(`/api/admin/network-suppression/batches/${openBatch.batch.batch_id}/apply`);
      toast.success(`Aplicado: ${r.applied} usuários suprimidos, ${r.reassigned_children} filhos reatribuídos`);
      setConfirmApply(false);
      await loadBatches();
      await openBatchDetail(openBatch.batch.batch_id);
    } catch (err) { toast.error(err.message || 'Erro ao aplicar'); }
    finally { setApplying(false); }
  };

  const doRevert = async () => {
    if (!openBatch) return;
    setReverting(true);
    try {
      const r = await api.post(`/api/admin/network-suppression/batches/${openBatch.batch.batch_id}/revert`);
      toast.success(`Revertido: ${r.restored} usuários restaurados, ${r.restored_children} filhos revertidos`);
      setConfirmRevert(false);
      await loadBatches();
      await openBatchDetail(openBatch.batch.batch_id);
    } catch (err) { toast.error(err.message || 'Erro ao reverter'); }
    finally { setReverting(false); }
  };

  const doDelete = async (batch_id) => {
    if (!window.confirm('Deletar este rascunho? Ação irreversível (nada foi aplicado, ok deletar).')) return;
    try {
      await api.del(`/api/admin/network-suppression/batches/${batch_id}`);
      toast.success('Rascunho deletado');
      if (openBatchId === batch_id) { setOpenBatchId(null); setOpenBatch(null); }
      await loadBatches();
    } catch (err) { toast.error(err.message || 'Erro deletando'); }
  };

  const filteredEntries = useMemo(() => {
    if (!openBatch) return [];
    let arr = openBatch.entries.filter((e) => e.match_status === tab);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((e) =>
        (e.email || '').toLowerCase().includes(s) ||
        (e.nome_planilha || '').toLowerCase().includes(s) ||
        (e.matched_user_name || '').toLowerCase().includes(s));
    }
    return arr;
  }, [openBatch, tab, search]);

  const summary = openBatch?.batch?.summary || {};
  const statusInfo = openBatch ? STATUS_LABEL[openBatch.batch.status] : null;
  const canApply = openBatch?.batch?.status === 'draft' && summary.matched > 0;
  const canRevert = openBatch?.batch?.status === 'applied';

  return (
    <div className="space-y-6" data-testid="admin-network-suppression">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-fg-primary flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-main" />
            Supressão de rede
          </h1>
          <p className="text-fg-secondary text-sm mt-1 max-w-2xl">
            Sobe a planilha mensal de cancelados da Ozoxx (.xls/.xlsx). O sistema faz o match por e-mail,
            monta um preview e — só depois da sua confirmação — desativa a rede desses usuários e
            reatribui os filhos diretos para o upline ativo mais próximo.
          </p>
        </div>
        <Button variant="secondary" onClick={loadBatches} disabled={loading} data-testid="ns-refresh">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar
        </Button>
      </div>

      {/* Upload card */}
      <div className="bg-bg-primary border border-border-primary rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-5 h-5 text-brand-main" />
          <h2 className="text-base font-semibold text-fg-primary">Enviar planilha de cancelados</h2>
        </div>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-fg-secondary mb-1 block">Arquivo (.xls ou .xlsx)</label>
            <input
              id="ns-file-input"
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-fg-primary file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-brand-main file:text-white file:rounded-lg file:cursor-pointer file:hover:bg-brand-main/90"
              data-testid="ns-file-picker"
            />
          </div>
          <div>
            <label className="text-xs text-fg-secondary mb-1 block">Mês referência</label>
            <input
              type="month"
              value={refMonth}
              onChange={(e) => setRefMonth(e.target.value)}
              className="border border-border-primary rounded-lg px-3 py-2 text-sm bg-bg-primary text-fg-primary"
              data-testid="ns-ref-month"
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading || !file} data-testid="ns-upload-btn">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Gerar preview
          </Button>
        </div>
        <p className="text-xs text-fg-secondary mt-3">
          Colunas obrigatórias na planilha: <b>EMAIL</b>. Colunas opcionais: NOME, CPF/CNPJ, TELEFONE, DATA CANCELAMENTO.
          As colunas <b>ID VENDEDOR / LOGIN VENDEDOR / NOME VENDEDOR</b> são ignoradas.
        </p>
      </div>

      {/* Batches list */}
      <div className="bg-bg-primary border border-border-primary rounded-xl">
        <div className="p-4 border-b border-border-primary flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-fg-secondary" />
          <h2 className="font-semibold text-fg-primary">Histórico de lotes</h2>
          <span className="ml-2 text-xs text-fg-secondary">{batches.length} lote{batches.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-fg-secondary flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
          </div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-fg-secondary">
            Nenhum lote ainda. Envie a primeira planilha acima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-fg-secondary">
                <tr>
                  <th className="text-left px-4 py-3">Arquivo</th>
                  <th className="text-left px-4 py-3">Mês ref.</th>
                  <th className="text-left px-4 py-3">Enviado por</th>
                  <th className="text-left px-4 py-3">Upload</th>
                  <th className="text-center px-4 py-3">Match</th>
                  <th className="text-center px-4 py-3">Filhos</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const s = STATUS_LABEL[b.status] || { label: b.status, variant: 'secondary' };
                  const stats = b.summary || {};
                  return (
                    <tr key={b.batch_id} className="border-t border-border-primary hover:bg-bg-secondary/40">
                      <td className="px-4 py-3 text-fg-primary">
                        <div className="font-medium">{b.filename}</div>
                        <div className="text-xs text-fg-secondary">{b.batch_id}</div>
                      </td>
                      <td className="px-4 py-3 text-fg-primary">{b.reference_month}</td>
                      <td className="px-4 py-3 text-fg-primary">{b.uploaded_by_name || '—'}</td>
                      <td className="px-4 py-3 text-fg-secondary">{fmtDate(b.uploaded_at)}</td>
                      <td className="px-4 py-3 text-center text-fg-primary">
                        <span className="text-emerald-600 font-semibold">{stats.matched || 0}</span>
                        <span className="text-fg-secondary"> / {stats.total_rows || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-fg-primary">{stats.children_to_reassign ?? '—'}</td>
                      <td className="px-4 py-3 text-center"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openBatchDetail(b.batch_id)} data-testid={`ns-view-${b.batch_id}`}>
                            Ver
                          </Button>
                          {b.status === 'draft' && (
                            <Button size="sm" variant="ghost" onClick={() => doDelete(b.batch_id)} data-testid={`ns-delete-${b.batch_id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch detail drawer */}
      {openBatchId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={(e) => e.target === e.currentTarget && setOpenBatchId(null)}>
          <div className="bg-bg-primary w-full max-w-6xl md:rounded-xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl" data-testid="ns-detail-drawer">
            {!openBatch ? (
              <div className="p-10 text-center text-fg-secondary flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Carregando lote…
              </div>
            ) : (
              <>
                <div className="p-5 border-b border-border-primary flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-fg-primary">{openBatch.batch.filename}</h3>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <div className="text-xs text-fg-secondary">
                      Mês ref: <b>{openBatch.batch.reference_month}</b> · Upload: {fmtDate(openBatch.batch.uploaded_at)}
                      {openBatch.batch.applied_at && <> · Aplicado: {fmtDate(openBatch.batch.applied_at)}</>}
                      {openBatch.batch.reverted_at && <> · Revertido: {fmtDate(openBatch.batch.reverted_at)}</>}
                    </div>
                  </div>
                  <button onClick={() => setOpenBatchId(null)} className="text-fg-secondary hover:text-fg-primary p-2" data-testid="ns-close-drawer">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-5 border-b border-border-primary bg-bg-secondary/30">
                  {[
                    ['total_rows', 'Linhas', 'text-fg-primary'],
                    ['matched', 'Encontrados', 'text-emerald-600'],
                    ['not_found', 'Não encontrado', 'text-slate-500'],
                    ['already_cancelled', 'Já cancelados', 'text-amber-600'],
                    ['email_ambiguous', 'Ambíguos', 'text-red-600'],
                  ].map(([k, label, cls]) => (
                    <div key={k} className="bg-bg-primary rounded-lg p-3 border border-border-primary text-center">
                      <div className={`text-2xl font-bold ${cls}`}>{summary[k] ?? 0}</div>
                      <div className="text-xs text-fg-secondary mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs + search */}
                <div className="px-5 pt-4 pb-2 border-b border-border-primary flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(MATCH_LABEL).map(([k, m]) => (
                      <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === k ? 'bg-brand-main text-white' : 'bg-bg-secondary text-fg-secondary hover:bg-bg-secondary/70'}`}
                        data-testid={`ns-tab-${k}`}
                      >
                        {m.label} <span className="opacity-70">({summary[k] || 0})</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-fg-secondary absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar email ou nome…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 pr-3 py-2 text-sm border border-border-primary rounded-lg bg-bg-primary min-w-[220px]"
                      data-testid="ns-search"
                    />
                  </div>
                </div>

                {/* Entries table */}
                <div className="flex-1 overflow-y-auto">
                  {filteredEntries.length === 0 ? (
                    <div className="p-10 text-center text-fg-secondary text-sm">
                      Nenhum registro nesta aba.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-bg-secondary text-fg-secondary sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2.5">#</th>
                          <th className="text-left px-4 py-2.5">E-mail</th>
                          <th className="text-left px-4 py-2.5">Nome (planilha)</th>
                          <th className="text-left px-4 py-2.5">Usuário OxxPharma</th>
                          {tab === 'matched' && <th className="text-left px-4 py-2.5">Reparent</th>}
                          {tab === 'matched' && <th className="text-center px-4 py-2.5">Filhos</th>}
                          <th className="text-left px-4 py-2.5">Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.map((e) => (
                          <tr key={e.entry_id} className="border-t border-border-primary hover:bg-bg-secondary/30">
                            <td className="px-4 py-2 text-fg-secondary">{e.row}</td>
                            <td className="px-4 py-2 text-fg-primary font-mono text-xs">{e.email}</td>
                            <td className="px-4 py-2 text-fg-primary">{e.nome_planilha || '—'}</td>
                            <td className="px-4 py-2 text-fg-primary">
                              {e.matched_user_name ? (
                                <div>
                                  <div className="font-medium">{e.matched_user_name}</div>
                                  <div className="text-xs text-fg-secondary">
                                    {e.matched_user_id} · {e.matched_user_network_type || '—'}
                                  </div>
                                </div>
                              ) : '—'}
                            </td>
                            {tab === 'matched' && (
                              <td className="px-4 py-2 text-fg-secondary text-xs font-mono">
                                <div className="flex items-center gap-1">
                                  <span className="text-red-600 line-through">{e.old_network_sponsor_id || '(raiz)'}</span>
                                  <ArrowRight className="w-3 h-3 shrink-0" />
                                  <span className="text-emerald-600">{e.new_network_sponsor_id || '(raiz)'}</span>
                                </div>
                              </td>
                            )}
                            {tab === 'matched' && (
                              <td className="px-4 py-2 text-center text-fg-primary">
                                {(openBatch.batch.status === 'applied') ? (e.children_reassigned_count ?? e.children_count ?? 0) : (e.children_count || 0)}
                              </td>
                            )}
                            <td className="px-4 py-2 text-fg-secondary text-xs">{e.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer actions */}
                <div className="border-t border-border-primary p-4 flex items-center justify-between gap-3 flex-wrap bg-bg-secondary/30">
                  <div className="text-xs text-fg-secondary">
                    {openBatch.batch.status === 'draft' && (
                      <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" />
                        Rascunho — confirme para aplicar as mudanças na rede
                      </span>
                    )}
                    {openBatch.batch.status === 'applied' && (
                      <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="w-4 h-4" />
                        Aplicado por {openBatch.batch.applied_by_name || '—'} · Revert disponível até fim do mês
                      </span>
                    )}
                    {openBatch.batch.status === 'reverted' && (
                      <span className="flex items-center gap-1.5 text-slate-500"><Undo2 className="w-4 h-4" />
                        Revertido por {openBatch.batch.reverted_by_name || '—'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canApply && !confirmApply && (
                      <Button onClick={() => setConfirmApply(true)} data-testid="ns-apply-btn">
                        <Shield className="w-4 h-4" />
                        Aplicar supressão
                      </Button>
                    )}
                    {canApply && confirmApply && (
                      <>
                        <Button variant="secondary" onClick={() => setConfirmApply(false)}>Cancelar</Button>
                        <Button variant="danger" onClick={doApply} disabled={applying} data-testid="ns-apply-confirm">
                          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                          Confirmar — suprimir {summary.matched} usuários
                        </Button>
                      </>
                    )}
                    {canRevert && !confirmRevert && (
                      <Button variant="secondary" onClick={() => setConfirmRevert(true)} data-testid="ns-revert-btn">
                        <Undo2 className="w-4 h-4" />
                        Reverter lote
                      </Button>
                    )}
                    {canRevert && confirmRevert && (
                      <>
                        <Button variant="secondary" onClick={() => setConfirmRevert(false)}>Cancelar</Button>
                        <Button variant="danger" onClick={doRevert} disabled={reverting} data-testid="ns-revert-confirm">
                          {reverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                          Confirmar reversão
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
