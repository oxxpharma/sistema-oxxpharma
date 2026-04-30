import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import ExportButton from '../../components/ExportButton';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCommissionsReport() {
  const [status, setStatus] = useState('paid');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ status });
      if (start) q.set('start', new Date(start).toISOString());
      if (end) q.set('end', new Date(end).toISOString());
      const d = await api.get(`/api/admin/commissions-report?${q}`);
      setData(d);
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const exportQuery = (() => {
    const q = new URLSearchParams({ status });
    if (start) q.set('start', new Date(start).toISOString());
    if (end) q.set('end', new Date(end).toISOString());
    return q.toString();
  })();

  return (
    <div data-testid="admin-commissions-report">
      <div className="mb-6">
        <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><FileText className="w-7 h-7 text-brand-main" /> Relatório de comissões</h1>
        <p className="text-sm text-txt-secondary mt-1">Agregado por usuário — pronto para enviar à empresa do cartão de benefícios.</p>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 mb-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs text-txt-secondary mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" data-testid="report-status">
            <option value="paid">Pagas</option>
            <option value="pending">Pendentes</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-txt-secondary mb-1">De</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-txt-secondary mb-1">Até</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="h-10 px-3 bg-bg-secondary border border-border rounded-lg text-sm" />
        </div>
        <Button onClick={load} variant="outline">Filtrar</Button>
        <ExportButton
          csvUrl={`/api/admin/commissions-report/export.csv?${exportQuery}`}
          xlsxUrl={`/api/admin/commissions-report/export.xlsx?${exportQuery}`}
          filename={`comissoes-${status}`}
          label="Exportar"
          variant="default"
          testId="export-commissions-btn"
        />
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">CPF</th>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Chave PIX</th>
                  <th className="text-right p-3">Nº comissões</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows?.map(r => (
                  <tr key={r.user_id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{r.cpf || '-'}</td>
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3 text-txt-secondary">{r.email}</td>
                    <td className="p-3 font-mono text-xs">{r.pix_key || '-'}</td>
                    <td className="p-3 text-right">{r.commissions_count}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
                {(!data?.rows || data.rows.length === 0) && <tr><td colSpan={6} className="p-10 text-center text-txt-secondary">Nenhuma comissão no filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
