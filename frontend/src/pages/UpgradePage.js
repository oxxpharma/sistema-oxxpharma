import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { formatCurrency } from '../lib/utils';
import { ArrowUpCircle, Users, DollarSign, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function UpgradePage() {
  const { user, token, accessLevel } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [investment, setInvestment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/upgrade/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setStatus(d);
        setInvestment(String(d.investment_required || 500));
      }
    } catch {} finally { setLoading(false); }
  };

  const handleUpgrade = async () => {
    setError('');
    setSuccess('');
    const amount = parseFloat(investment);
    if (!amount || amount <= 0) { setError('Valor invalido'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/upgrade/request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ investment_amount: amount }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Erro ao solicitar upgrade');
      } else {
        setSuccess('Solicitacao de upgrade enviada com sucesso! Aguarde aprovacao do administrador.');
        fetchStatus();
      }
    } catch { setError('Erro de conexao'); } finally { setSubmitting(false); }
  };

  if (accessLevel === 6) {
    return (
      <AppLayout title="Upgrade" subtitle="Voce ja e uma Unidade Indicadora!">
        <div className="max-w-lg fade-in">
          <DashCard>
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 mx-auto text-accent-green mb-4" />
              <h2 className="font-heading font-bold text-xl text-txt-primary">Parabens!</h2>
              <p className="text-sm text-txt-secondary mt-2">Voce ja foi promovido a Unidade Indicadora e esta ganhando comissoes pelas suas indicacoes.</p>
              <button onClick={() => navigate('/dashboard')} className="mt-6 px-6 py-2.5 bg-brand-main text-white text-sm font-semibold rounded-md hover:bg-brand-hover">
                Voltar ao Dashboard
              </button>
            </div>
          </DashCard>
        </div>
      </AppLayout>
    );
  }

  if (accessLevel !== 5) {
    return (
      <AppLayout title="Upgrade">
        <div className="max-w-lg fade-in">
          <DashCard>
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 mx-auto text-txt-secondary mb-3" />
              <p className="text-txt-secondary">O upgrade esta disponivel apenas para Indicadores.</p>
            </div>
          </DashCard>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Upgrade">
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Upgrade para Unidade Indicadora" subtitle="Passe a ganhar com suas indicacoes">
      <div className="max-w-lg space-y-6 fade-in">

        {/* Pending Request Banner */}
        {status?.pending_request && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3" data-testid="pending-upgrade">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Solicitacao Pendente</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Sua solicitacao esta em analise. Investimento: {formatCurrency(status.pending_request.investment_amount)}
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        <DashCard title="Progresso de Indicacoes">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-main" />
                <span className="text-sm font-medium text-txt-primary">Suas Indicacoes</span>
              </div>
              <span className="text-lg font-heading font-bold text-brand-main">
                {status?.total_referrals || 0} / {status?.min_referrals || 20}
              </span>
            </div>
            <div className="w-full h-4 bg-bg-secondary rounded-full overflow-hidden border border-border">
              <div
                className={`h-full rounded-full transition-all duration-700 ${status?.eligible ? 'bg-accent-green' : 'bg-brand-main'}`}
                style={{ width: `${status?.progress_percent || 0}%` }}
                data-testid="upgrade-progress-bar"
              />
            </div>
            <p className="text-xs text-txt-secondary">
              {status?.eligible
                ? 'Voce atingiu o minimo de indicacoes! Agora basta fazer o investimento.'
                : `Faltam ${Math.max(0, (status?.min_referrals || 20) - (status?.total_referrals || 0))} indicacoes para liberar o upgrade.`}
            </p>
          </div>
        </DashCard>

        {/* Investment Form */}
        <DashCard title="Investimento para Upgrade">
          <div className="space-y-4">
            <div className="p-4 bg-bg-secondary rounded-md border border-border">
              <div className="flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-accent-green" />
                <div>
                  <p className="text-xs text-txt-secondary">Investimento Minimo</p>
                  <p className="text-xl font-heading font-bold text-txt-primary">{formatCurrency(status?.investment_required || 500)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">Valor do Investimento (R$)</label>
                <input
                  type="number" value={investment} onChange={e => setInvestment(e.target.value)}
                  min={status?.investment_required || 500}
                  className="w-full px-3 py-2.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-main"
                  data-testid="upgrade-investment-input"
                  disabled={!status?.eligible || !!status?.pending_request}
                />
              </div>

              <div className="space-y-2 text-sm text-txt-secondary">
                <p className="font-medium text-txt-primary">O que muda com o upgrade:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Voce passa a ser uma <strong>Unidade Indicadora</strong></li>
                  <li>Comece a receber comissoes pelas suas indicacoes</li>
                  <li>Ganhe ate a 6a geracao na sua rede</li>
                </ul>
              </div>
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-accent-red" data-testid="upgrade-error">{error}</div>}
            {success && <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700" data-testid="upgrade-success">{success}</div>}

            <button
              onClick={handleUpgrade}
              disabled={!status?.eligible || submitting || !!status?.pending_request}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-main text-white font-semibold text-sm rounded-md hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              data-testid="upgrade-submit-btn"
            >
              <ArrowUpCircle className="w-5 h-5" />
              {submitting ? 'Enviando...' : status?.pending_request ? 'Solicitacao Pendente' : 'Solicitar Upgrade'}
            </button>
          </div>
        </DashCard>
      </div>
    </AppLayout>
  );
}
