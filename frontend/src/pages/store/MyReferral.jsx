import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_URL } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Share2, Copy, Users, DollarSign, Clock, CheckCircle2, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function MyReferral() {
  const [data, setData] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ref, comms] = await Promise.all([
          api.get('/api/users/me/referral'),
          api.get('/api/users/me/commissions'),
        ]);
        setData(ref);
        setCommissions(comms.commissions || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!data) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${origin}/?ref=${data.referral_code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OxxPharma - Farmácia digital',
          text: 'Comprei na OxxPharma e adorei! Aproveita meu link:',
          url: referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" data-testid="my-referral">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-2 flex items-center gap-3">
        <Share2 className="w-7 h-7 text-brand-main" /> Indique e ganhe 8%
      </h1>
      <p className="text-sm text-txt-secondary mb-6">
        Compartilhe seu link personalizado. A cada compra feita através dele, você ganha {Math.round(data.commission_rate * 100)}% de comissão.
      </p>

      <div className="flex justify-end mb-4">
        <Link to="/meus-saques" className="text-sm text-brand-main font-semibold inline-flex items-center gap-1 hover:underline">
          <Wallet className="w-4 h-4" /> Ver meus saques →
        </Link>
      </div>

      {/* Cartão principal */}
      <div className="bg-gradient-to-br from-brand-main via-brand-hover to-orange-700 text-white rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-2">Seu link de indicação</div>
          <div className="bg-white/15 backdrop-blur border border-white/20 rounded-lg p-3 flex items-center gap-2 mb-4">
            <span className="font-mono text-sm truncate flex-1" data-testid="referral-link-text">{referralLink}</span>
            <button onClick={copyLink} className="p-2 hover:bg-white/20 rounded-lg" title="Copiar">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyLink} className="bg-white text-brand-main border-white hover:bg-white/90" data-testid="copy-link-btn">
              <Copy className="w-4 h-4" /> Copiar link
            </Button>
            <Button variant="dark" onClick={share} data-testid="share-btn">
              <Share2 className="w-4 h-4" /> Compartilhar
            </Button>
          </div>
          <div className="mt-4 text-xs text-white/80">
            Código: <span className="font-mono font-bold tracking-wider">{data.referral_code}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="w-10 h-10 bg-brand-light rounded-lg flex items-center justify-center mb-2">
            <Users className="w-5 h-5 text-brand-main" />
          </div>
          <div className="text-2xl font-heading font-black">{data.referrals_count}</div>
          <div className="text-xs text-txt-secondary">Pessoas indicadas</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-heading font-black text-emerald-600">{formatCurrency(data.stats.paid)}</div>
          <div className="text-xs text-txt-secondary">Recebido</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-2">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-heading font-black text-amber-600">{formatCurrency(data.stats.pending)}</div>
          <div className="text-xs text-txt-secondary">Pendente</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="w-10 h-10 bg-brand-light rounded-lg flex items-center justify-center mb-2">
            <CheckCircle2 className="w-5 h-5 text-brand-main" />
          </div>
          <div className="text-2xl font-heading font-black">{data.stats.total_count}</div>
          <div className="text-xs text-txt-secondary">Vendas totais</div>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-heading font-black text-lg">Histórico de comissões</h2>
        </div>
        {commissions.length === 0 ? (
          <div className="p-12 text-center text-txt-secondary text-sm">
            Nenhuma comissão ainda. Compartilhe seu link para começar a ganhar!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Pedido</th>
                  <th className="text-right p-3">Valor pedido</th>
                  <th className="text-right p-3">Comissão</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map(c => (
                  <tr key={c.commission_id} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap text-xs">{formatDateTime(c.created_at)}</td>
                    <td className="p-3">{c.customer_name}</td>
                    <td className="p-3 font-mono text-xs">#{c.order_id.slice(-8).toUpperCase()}</td>
                    <td className="p-3 text-right">{formatCurrency(c.order_subtotal)}</td>
                    <td className="p-3 text-right font-bold text-brand-main">{formatCurrency(c.amount)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={c.status === 'paid' ? 'success' : c.status === 'cancelled' ? 'error' : 'warning'}>
                        {c.status === 'paid' ? 'Pago' : c.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
