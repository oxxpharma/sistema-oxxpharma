import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard, StatCard } from '../components/layout/AppLayout';
import { Wallet as WalletIcon, Clock, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function WalletPage() {
  const { token, user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchWallet(); }, []);

  const fetchWallet = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setWallet(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const handleWithdraw = async () => {
    setError('');
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { setError('Valor invalido'); return; }
    setWithdrawing(true);
    try {
      const res = await fetch(`${API_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Erro ao solicitar saque');
      } else {
        setWithdrawAmount('');
        fetchWallet();
      }
    } catch { setError('Erro de conexao'); } finally { setWithdrawing(false); }
  };

  if (loading) {
    return (
      <AppLayout title="Carteira">
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Carteira" subtitle="Gerencie seu saldo">
      <div className="space-y-6 fade-in max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard icon={WalletIcon} label="Saldo Disponivel" value={formatCurrency(wallet?.available_balance || 0)} color="green" />
          <StatCard icon={Clock} label="Saldo Bloqueado" value={formatCurrency(wallet?.blocked_balance || 0)} color="amber" />
        </div>

        <DashCard title="Solicitar Saque">
          {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-accent-red">{error}</div>}
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Valor do saque (R$)"
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-main"
                data-testid="withdraw-amount"
              />
            </div>
            <button
              onClick={handleWithdraw} disabled={withdrawing}
              className="px-6 py-2.5 bg-brand-main text-white font-semibold text-sm rounded-md hover:bg-brand-hover disabled:opacity-50"
              data-testid="withdraw-btn"
            >
              {withdrawing ? 'Solicitando...' : 'Solicitar'}
            </button>
          </div>
        </DashCard>

        <DashCard title="Transacoes Recentes" noPadding>
          {(!wallet?.transactions || wallet.transactions.length === 0) ? (
            <div className="text-center py-8 text-txt-secondary text-sm">Nenhuma transacao</div>
          ) : (
            <div className="divide-y divide-border">
              {wallet.transactions.map(tx => (
                <div key={tx.transaction_id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${tx.amount >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    {tx.amount >= 0 ? <ArrowDownRight className="w-4 h-4 text-accent-green" /> : <ArrowUpRight className="w-4 h-4 text-accent-red" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-txt-primary truncate">{tx.description}</p>
                    <p className="text-xs text-txt-secondary">{formatDateTime(tx.created_at)}</p>
                  </div>
                  <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>
    </AppLayout>
  );
}
