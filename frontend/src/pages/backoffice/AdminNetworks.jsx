import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Upload, Users, Network, Loader2, Search, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../../components/admin/Pagination';
import ResolvePendingLeadersModal from '../../components/admin/ResolvePendingLeadersModal';

const PAGE_LIMIT = 20;

const TABS = [
  { id: 'network_1', label: 'Equipe 1 (Corporativo)', color: 'brand' },
  { id: 'network_2', label: 'Equipe 2 (Propagandistas)', color: 'success' },
  { id: 'customer', label: 'Indicadores (clientes)', color: 'default' },
];

export default function AdminNetworks() {
  const [tab, setTab] = useState('network_1');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ network_type: tab, page: String(targetPage), limit: String(PAGE_LIMIT) });
      if (search) q.set('search', search);
      const d = await api.get(`/api/admin/users-by-network?${q}`);
      setUsers(d.users || []);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
      setPage(d.page || targetPage);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [tab]);

  const promote = async (uid) => {
    if (!window.confirm('Promover este cliente a Propagandista?')) return;
    try { await api.post(`/api/admin/users/${uid}/promote-to-propagandista`); toast.success('Promovido'); load(page); } catch (err) { toast.error(err.message); }
  };
  const revoke = async (uid) => {
    if (!window.confirm('Revogar status de Propagandista?')) return;
    try { await api.post(`/api/admin/users/${uid}/revoke-network`); toast.success('Revogado'); load(page); } catch (err) { toast.error(err.message); }
  };

  // Iter 42o: Varredura na rede — modal com preview e seleção
  const [showResolveModal, setShowResolveModal] = useState(false);

  return (
    <div data-testid="admin-networks">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><Network className="w-7 h-7 text-brand-main" /> Redes Equipe</h1>
          <p className="text-sm text-txt-secondary mt-1">Gerencie usuários por tipo de rede.</p>
        </div>
        {tab === 'network_1' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowResolveModal(true)} data-testid="resolve-pending-btn">
              <RefreshCw className="w-4 h-4" /> Varrer rede (vincular pendentes)
            </Button>
            <Button onClick={() => setShowImport(true)} data-testid="import-btn"><Upload className="w-4 h-4" /> Importar Equipe 1</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${tab === t.id ? 'bg-brand-main text-white border-brand-main' : 'bg-white border-border hover:border-brand-main/40'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-border p-3 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou ID externo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(1)}
            className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-lg text-sm"
          />
        </div>
        <Button variant="outline" onClick={() => load(1)}>Buscar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">Email</th>
                  {tab === 'network_1' && <th className="text-left p-3">ID externo</th>}
                  <th className="text-left p-3">Cód. ref.</th>
                  <th className="text-left p-3">Sponsor rede</th>
                  <th className="text-left p-3">Cadastro</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-t border-border hover:bg-bg-secondary/50" data-testid={`user-${u.user_id}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-light text-brand-main font-bold flex items-center justify-center">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-txt-secondary text-xs">{u.email}</td>
                    {tab === 'network_1' && <td className="p-3 font-mono text-xs">{u.external_id || '-'}</td>}
                    <td className="p-3 font-mono text-xs">{u.referral_code}</td>
                    <td className="p-3 font-mono text-xs text-txt-secondary">{u.network_sponsor_id || '-'}</td>
                    <td className="p-3 text-xs">{formatDateTime(u.created_at)}</td>
                    <td className="p-3 text-right">
                      {tab === 'customer' && (
                        <Button size="xs" onClick={() => promote(u.user_id)} data-testid={`promote-${u.user_id}`}>Promover</Button>
                      )}
                      {tab === 'network_2' && (
                        <Button size="xs" variant="danger" onClick={() => revoke(u.user_id)} data-testid={`revoke-${u.user_id}`}>Revogar</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-txt-secondary">Nenhum usuário nesta rede.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} pages={pages} total={total} limit={PAGE_LIMIT} onChange={(p) => load(p)} testId="networks-pagination" />
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => { setShowImport(false); load(1); }} />}
      <ResolvePendingLeadersModal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        onApplied={() => load(page)}
      />
    </div>
  );
}

function ImportModal({ onClose }) {
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const parseCsv = (text) => {
    // Simple CSV parser (assumes comma separator, first line header)
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const findCol = (names) => {
      for (const n of names) {
        const i = headers.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const idxId = findCol(['id', 'external_id', 'id externo', 'usuario_id']);
    const idxName = findCol(['nome', 'name', 'nome completo']);
    const idxEmail = findCol(['email', 'e-mail']);
    const idxLeader = findCol(['id_lider', 'leader_id', 'id líder', 'id lider', 'leader_external_id']);
    const idxPhone = findCol(['telefone', 'phone', 'celular']);
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (!cols[idxEmail]) continue;
      out.push({
        external_id: cols[idxId] || `ext_${Date.now()}_${i}`,
        name: cols[idxName] || '',
        email: cols[idxEmail],
        leader_external_id: idxLeader >= 0 ? (cols[idxLeader] || null) : null,
        phone: idxPhone >= 0 ? cols[idxPhone] : null,
      });
    }
    return out;
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result || ''));
      setRows(parsed);
      setPreview(parsed.slice(0, 10));
    };
    reader.readAsText(f, 'utf-8');
  };

  const doImport = async () => {
    if (!rows.length) { toast.error('Nenhuma linha para importar'); return; }
    setImporting(true);
    try {
      const res = await api.post('/api/admin/network1/import', { rows });
      setResult(res);
      toast.success(`Importação concluída: ${res.created} criados, ${res.updated} atualizados, ${res.sponsors_mapped} vínculos.`);
    } catch (err) { toast.error(err.message); } finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h2 className="font-heading font-black text-xl flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-brand-main" /> Importar Equipe 1</h2>
          <p className="text-xs text-txt-secondary mt-1">
            Envie um arquivo <strong>CSV</strong> com colunas: <code>id, nome, email, id_lider, telefone</code>. A primeira linha deve ser o cabeçalho.
          </p>
          <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <strong>Dica:</strong> se seu relatório está em Excel, salve como CSV (UTF-8) antes de enviar.
            Novos usuários recebem a senha padrão <code className="bg-white px-1 rounded">oxx@pharma</code>.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="w-full text-sm" data-testid="import-file" />
          {preview.length > 0 && (
            <div>
              <div className="text-xs text-txt-secondary mb-2">Pré-visualização ({rows.length} linhas detectadas):</div>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="p-2 text-left">ID externo</th>
                      <th className="p-2 text-left">Nome</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-left">ID Líder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 font-mono">{r.external_id}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2 font-mono">{r.leader_external_id || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
              <div><strong>Criados:</strong> {result.created}</div>
              <div><strong>Atualizados:</strong> {result.updated}</div>
              <div><strong>Vínculos com líder:</strong> {result.sponsors_mapped}</div>
              <div><strong>Erros:</strong> {result.errors?.length || 0}</div>
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button onClick={doImport} loading={importing} disabled={!rows.length} data-testid="do-import-btn">Importar {rows.length || ''}</Button>
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
