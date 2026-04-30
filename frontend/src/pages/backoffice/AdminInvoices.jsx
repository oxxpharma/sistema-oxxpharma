import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import ExportButton from '../../components/ExportButton';
import { Search, Eye, Loader2, Receipt } from 'lucide-react';

export default function AdminInvoices() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: '100' });
      if (search) q.set('search', search);
      const d = await api.get(`/api/admin/invoices?${q}`);
      setData(d);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const exportQuery = search ? `?search=${encodeURIComponent(search)}` : '';

  return (
    <div data-testid="admin-invoices">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><Receipt className="w-7 h-7 text-brand-main" /> Faturamento</h1>
          <p className="text-sm text-txt-secondary mt-1">Notas emitidas automaticamente quando o pedido é marcado como pago.</p>
        </div>
        <ExportButton
          csvUrl={`/api/admin/invoices/export.csv${exportQuery}`}
          xlsxUrl={`/api/admin/invoices/export.xlsx${exportQuery}`}
          filename="faturamento"
          label="Exportar"
          testId="export-invoices-btn"
        />
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-txt-secondary">Notas emitidas</div>
          <div className="text-2xl font-heading font-black">{data?.totals?.count ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-txt-secondary">Subtotal acumulado</div>
          <div className="text-2xl font-heading font-black">{formatCurrency(data?.totals?.subtotal ?? 0)}</div>
        </div>
        <div className="bg-gradient-to-br from-brand-main to-brand-hover text-white rounded-xl p-4">
          <div className="text-xs opacity-80">Total faturado</div>
          <div className="text-2xl font-heading font-black">{formatCurrency(data?.totals?.total ?? 0)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-border p-3 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número da nota, cliente ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-lg text-sm"
          />
        </div>
        <Button variant="outline" onClick={load}>Buscar</Button>
      </div>

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Nº Nota</th>
                  <th className="text-left p-3">Emitida em</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Pedido</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.invoices?.map(o => (
                  <tr key={o.order_id} className="border-t border-border hover:bg-bg-secondary/50" data-testid={`invoice-${o.order_id}`}>
                    <td className="p-3 font-mono font-bold">{o.invoice_number}</td>
                    <td className="p-3 text-xs">{formatDateTime(o.invoice_issued_at)}</td>
                    <td className="p-3">
                      <div className="font-semibold">{o.customer_name}</div>
                      <div className="text-xs text-txt-secondary">{o.customer_email}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">#{o.order_id.slice(-8).toUpperCase()}</td>
                    <td className="p-3 text-right font-bold">{formatCurrency(o.total)}</td>
                    <td className="p-3 text-right">
                      <Link to={`/pedido/${o.order_id}/nota`} target="_blank" className="inline-flex items-center gap-1 text-brand-main font-semibold text-xs hover:underline" data-testid={`view-invoice-${o.order_id}`}>
                        <Eye className="w-3.5 h-3.5" /> Ver / Imprimir
                      </Link>
                    </td>
                  </tr>
                ))}
                {(!data?.invoices || data.invoices.length === 0) && <tr><td colSpan={6} className="p-10 text-center text-txt-secondary">Nenhuma nota emitida ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
