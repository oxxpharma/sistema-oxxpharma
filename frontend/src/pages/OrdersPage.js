import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { formatCurrency, formatDate } from '../lib/utils';
import { ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function OrdersPage() {
  const { token, accessLevel } = useAuth();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrders(); }, [page, filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/orders?page=${page}&limit=15`;
      if (filter) url += `&status=${filter}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setOrders(d.orders); setTotal(d.total); }
    } catch {} finally { setLoading(false); }
  };

  const updateStatus = async (orderId, status) => {
    await fetch(`${API_URL}/api/orders/${orderId}/status?status=${status}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    fetchOrders();
  };

  const statusBadge = (s) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-700',
      paid: 'bg-blue-100 text-blue-700',
      shipped: 'bg-violet-100 text-violet-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-600',
    };
    return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[s] || 'bg-gray-100'}`}>{s}</span>;
  };

  return (
    <AppLayout title="Pedidos" subtitle={`${total} pedidos`}>
      <div className="space-y-4 fade-in">
        <div className="flex gap-3">
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-border rounded-md text-sm bg-white" data-testid="orders-filter">
            <option value="">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="paid">Pagos</option>
            <option value="shipped">Enviados</option>
            <option value="delivered">Entregues</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        <div className="bg-white border border-border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Pedido</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Itens</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Total</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Data</th>
                  {accessLevel <= 1 && <th className="text-right px-4 py-2.5 text-xs font-semibold text-txt-secondary uppercase">Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-txt-secondary">Carregando...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-txt-secondary">Nenhum pedido</td></tr>
                ) : orders.map(o => (
                  <tr key={o.order_id} className="border-b border-border hover:bg-bg-secondary/50">
                    <td className="px-4 py-2.5 font-mono text-xs">{o.order_id}</td>
                    <td className="px-4 py-2.5 text-txt-secondary">{o.items?.length || 0} item(s)</td>
                    <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(o.total)}</td>
                    <td className="px-4 py-2.5">{statusBadge(o.order_status)}</td>
                    <td className="px-4 py-2.5 text-xs text-txt-secondary">{formatDate(o.created_at)}</td>
                    {accessLevel <= 1 && (
                      <td className="px-4 py-2.5 text-right">
                        <select
                          value={o.order_status}
                          onChange={e => updateStatus(o.order_id, e.target.value)}
                          className="text-xs border border-border rounded px-2 py-1 bg-white"
                          data-testid={`order-status-${o.order_id}`}
                        >
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago</option>
                          <option value="shipped">Enviado</option>
                          <option value="delivered">Entregue</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
