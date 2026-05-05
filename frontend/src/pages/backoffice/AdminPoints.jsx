import React, { useEffect, useState } from 'react';
import { api, API_URL } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Award, Loader2, Download, RefreshCw, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../lib/utils';
import Pagination from '../../components/admin/Pagination';

const PAGE_LIMIT = 50;

export default function AdminPoints() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_points: 0, count: 0 });
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (start) q.set('start', start);
      if (end) q.set('end', end);
      if (appliedFilter !== '') q.set('applied', appliedFilter);
      q.set('page', String(targetPage));
      q.set('limit', String(PAGE_LIMIT));
      const r = await api.get(`/api/admin/points-report?${q}`);
      setLogs(r.logs || []);
      setSummary(r.summary || { total_points: 0, count: 0 });
      setPages(r.pages || 1);
      setTotal(r.total || 0);
      setPage(r.page || targetPage);
      setSelected(new Set());
    } catch (e) { toast.error(e?.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);

  const downloadXlsx = () => {
    const token = localStorage.getItem('token');
    const q = new URLSearchParams();
    if (start) q.set('start', start);
    if (end) q.set('end', end);
    fetch(`${API_URL}/api/admin/points-report/export.xlsx?${q}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'relatorio-pontos.xlsx';
        a.click();
      });
  };

  const markApplied = async () => {
    if (selected.size === 0) { toast.error('Selecione pelo menos um registro'); return; }
    if (!window.confirm(`Marcar ${selected.size} registros como APLICADOS no sistema externo?`)) return;
    try {
      await api.post('/api/admin/points-report/mark-applied', { log_ids: Array.from(selected) });
      toast.success('Marcados');
      load(page);
    } catch (e) { toast.error(e?.message); }
  };

  const toggleSelect = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };
  const selectAllVisible = () => {
    if (selected.size === logs.length) setSelected(new Set());
    else setSelected(new Set(logs.map(l => l.log_id)));
  };

  return (
    <div data-testid="admin-points">
      <div className="mb-6">
        <h1 className="font-heading font-black text-2xl flex items-center gap-3">
          <Award className="w-7 h-7 text-brand-main" /> Relatório de Pontos
        </h1>
        <p className="text-sm text-txt-secondary mt-1">
          Pontos gerados por cada compra paga, prontos para serem aplicados no sistema externo manualmente.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Card label="Total de pontos" value={summary.total_points.toLocaleString('pt-BR')} />
        <Card label="Registros" value={summary.count} />
        <Card label="Selecionados" value={selected.size} />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-border p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[11px] font-semibold block mb-1">De</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="px-3 py-2 border border-border rounded text-sm" data-testid="filter-start" />
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1">Até</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="px-3 py-2 border border-border rounded text-sm" data-testid="filter-end" />
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1">Aplicado</label>
          <select value={appliedFilter} onChange={e => setAppliedFilter(e.target.value)} className="px-3 py-2 border border-border rounded text-sm">
            <option value="">Todos</option>
            <option value="false">Pendentes</option>
            <option value="true">Aplicados</option>
          </select>
        </div>
        <Button variant="outline" onClick={() => load(1)}><Search className="w-4 h-4" /> Filtrar</Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => load(page)}><RefreshCw className="w-4 h-4" /> Atualizar</Button>
        <Button variant="outline" onClick={downloadXlsx} data-testid="export-xlsx-btn"><Download className="w-4 h-4" /> Exportar XLSX</Button>
        <Button onClick={markApplied} disabled={selected.size === 0} data-testid="mark-applied-btn">
          <CheckCircle2 className="w-4 h-4" /> Marcar como aplicado ({selected.size})
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="p-3 w-8"><input type="checkbox" checked={selected.size === logs.length && logs.length > 0} onChange={selectAllVisible} /></th>
                  <th className="text-left p-3">Data/Hora</th>
                  <th className="text-left p-3">User ID</th>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-right p-3">Qtd</th>
                  <th className="text-right p-3">Pts/un</th>
                  <th className="text-right p-3">Pts total</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-txt-secondary">Nenhum ponto registrado.</td></tr>}
                {logs.map(l => (
                  <tr key={l.log_id} className="border-t border-border">
                    <td className="p-3"><input type="checkbox" checked={selected.has(l.log_id)} onChange={() => toggleSelect(l.log_id)} /></td>
                    <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(l.registered_at)}</td>
                    <td className="p-3 font-mono text-xs">{l.user_external_id || l.user_id}</td>
                    <td className="p-3"><div className="font-semibold">{l.user_name}</div><div className="text-xs text-txt-secondary">{l.user_email}</div></td>
                    <td className="p-3 text-xs">{l.product_name}</td>
                    <td className="p-3 text-right">{l.quantity}</td>
                    <td className="p-3 text-right">{l.points_per_unit}</td>
                    <td className="p-3 text-right font-bold text-brand-main">{l.points_total}</td>
                    <td className="p-3 text-center">
                      {l.applied_externally ? <Badge variant="success">Aplicado</Badge> : <Badge variant="warning">Pendente</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-4">
          <Pagination page={page} pages={pages} total={total} limit={PAGE_LIMIT} onChange={(p) => load(p)} testId="points-pagination" />
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="text-xs uppercase tracking-widest text-txt-secondary font-semibold mb-1">{label}</div>
      <div className="text-2xl font-heading font-black">{value}</div>
    </div>
  );
}
