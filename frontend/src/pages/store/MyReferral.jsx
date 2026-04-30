import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Share2, Copy, Users, DollarSign, Clock, CheckCircle2, Loader2, Wallet, CreditCard, Send, Gift } from 'lucide-react';
import { toast } from 'sonner';
import ReferralEnrollmentForm from '../../components/ReferralEnrollmentForm';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { getIcon } from '../../lib/iconLibrary';

export default function MyReferral() {
  const [data, setData] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const settings = useSiteSettings();

  const load = async () => {
    const [ref, comms] = await Promise.all([
      api.get('/api/users/me/referral'),
      api.get('/api/users/me/commissions'),
    ]);
    setData(ref);
    setCommissions(comms.commissions || []);
  };

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!data) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = data.has_referral_program && data.referral_code
    ? `${origin}/?ref=${data.referral_code}`
    : '';

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
          title: 'OxxPharma',
          text: 'Comprei na OxxPharma e adorei! Aproveita meu link:',
          url: referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  const onEnrollSuccess = async (resp) => {
    setShowForm(false);
    if (resp?.status === 'pending_approval') {
      toast.success('Solicitação enviada! O administrador irá analisar sua adesão.');
    } else {
      toast.success('Você agora está no programa! Seu link foi gerado.');
    }
    await load();
  };

  // ========== ADESÃO PENDENTE DE APROVAÇÃO ==========
  if (data.referral_enrollment_status === 'pending_approval') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12" data-testid="my-referral-pending">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="font-heading font-black text-2xl text-amber-900 mb-2">Adesão em análise</h1>
          <p className="text-amber-800 max-w-md mx-auto">
            Sua solicitação para participar do <b>programa de indicação</b> foi recebida e está sendo analisada pelo nosso administrador.
            Você receberá um e-mail assim que houver uma resposta.
          </p>
          <div className="text-xs text-amber-700 mt-6 bg-white/60 rounded-lg py-2 px-4 inline-block">
            Costumamos responder em até 1 dia útil.
          </div>
        </div>
      </div>
    );
  }

  // ========== ADESÃO REJEITADA ==========
  if (data.referral_enrollment_status === 'rejected') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12" data-testid="my-referral-rejected">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="font-heading font-black text-2xl text-red-900 mb-2">Adesão não aprovada</h1>
          {data.referral_rejected_reason && (
            <p className="text-red-800 mt-2 mb-4 text-sm bg-white/60 rounded-lg py-2 px-4 inline-block">
              {data.referral_rejected_reason}
            </p>
          )}
          <p className="text-red-800 max-w-md mx-auto mb-6">
            Você pode entrar em contato com o suporte ou enviar uma nova solicitação.
          </p>
          <Button onClick={() => setShowForm(true)} data-testid="reenroll-btn">
            <Share2 className="w-4 h-4" /> Reenviar solicitação
          </Button>
        </div>
        {showForm && (
          <ReferralEnrollmentForm onClose={() => setShowForm(false)} onSuccess={onEnrollSuccess} />
        )}
      </div>
    );
  }

  // ========== BANNER DE ADESÃO (usuário ainda não aderiu) ==========
  if (!data.has_referral_program) {
    const programName = settings?.referral_program_name || 'Cartão de Benefícios';
    const storeName = settings?.store_name || 'OxxPharma';
    const badge = settings?.referral_box_badge || 'NOVO PROGRAMA';
    const titleRaw = settings?.referral_box_title || `${programName}\n${storeName}`;
    const desc = settings?.referral_box_description || `Indique amigos e receba suas comissões direto no <b>seu cartão</b>. Adira agora ao programa, gere seu link personalizado e comece a ganhar em cada compra indicada.`;
    const ctaLabel = settings?.referral_box_cta_label || 'Aderir ao programa de indicação';
    const features = (settings?.referral_box_features && settings.referral_box_features.length)
      ? settings.referral_box_features
      : [
        { icon: 'Gift', title: 'Cartão de Benefícios', desc: 'Receba suas comissões em um cartão de benefícios exclusivo.' },
        { icon: 'Share2', title: 'Link exclusivo', desc: 'Compartilhe seu código nas redes sociais.' },
        { icon: 'Send', title: 'Envio diário', desc: 'Todo dia às 23:59 seu saldo é enviado pro cartão.' },
      ];
    return (
      <div className="max-w-4xl mx-auto px-4 py-8" data-testid="my-referral">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-main via-brand-hover to-orange-700 text-white p-8 md:p-12 shadow-xl">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-6">
              <Gift className="w-3.5 h-3.5" /> {badge}
            </div>
            <h1 className="font-heading font-black text-3xl md:text-5xl mb-4 leading-tight whitespace-pre-line">
              {titleRaw}
            </h1>
            <p className="text-white/90 text-base md:text-lg max-w-xl mb-6" dangerouslySetInnerHTML={{ __html: desc }} />
            <Button
              size="lg"
              onClick={() => setShowForm(true)}
              className="bg-white text-brand-main hover:bg-white/90 border-white font-bold shadow-lg"
              data-testid="enroll-program-btn"
            >
              <CreditCard className="w-5 h-5" /> {ctaLabel}
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
              {features.slice(0, 3).map((f, i) => {
                const Ic = getIcon(f.icon);
                return (
                  <div key={i} className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/15">
                    <Ic className="w-6 h-6 mb-2" />
                    <div className="font-bold mb-1">{f.title}</div>
                    <div className="text-xs text-white/80">{f.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {showForm && (
          <ReferralEnrollmentForm
            onClose={() => setShowForm(false)}
            onSuccess={onEnrollSuccess}
          />
        )}
      </div>
    );
  }

  // ========== USUÁRIO JÁ ADERIU ==========
  return (
    <div className="max-w-5xl mx-auto px-4 py-8" data-testid="my-referral">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-2 flex items-center gap-3">
        <Share2 className="w-7 h-7 text-brand-main" /> Indique e ganhe {Math.round(data.commission_rate * 100)}%
      </h1>
      <p className="text-sm text-txt-secondary mb-6">
        Compartilhe seu link personalizado. A cada compra feita através dele, sua comissão entra no seu saldo na conta.
      </p>

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

      {/* Saldos novos: Conta + Histórico de envios para o cartão */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border p-5 relative overflow-hidden" data-testid="balance-account">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-txt-secondary font-semibold mb-1">Saldo na conta</div>
              <div className="text-3xl font-heading font-black text-emerald-600">{formatCurrency(data.account_balance)}</div>
              <div className="text-xs text-txt-secondary mt-1">Bônus acumulados aguardando envio para o cartão.</div>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5" data-testid="balance-sent-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-txt-secondary font-semibold mb-1">Envios para o cartão</div>
              <div className="text-xs text-txt-secondary">Cada bônus enviado fica disponível em até <b>{data.card_release_days || 2} dias úteis</b>.</div>
            </div>
            <div className="w-10 h-10 bg-brand-light rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-brand-main" />
            </div>
          </div>
          {(!data.card_history || data.card_history.length === 0) ? (
            <div className="text-xs text-txt-secondary text-center py-4">
              Nenhum bônus enviado ao cartão ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-44 overflow-y-auto -mx-1">
              {data.card_history.map((h, i) => {
                const availableDate = h.available_at ? new Date(h.available_at) : null;
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const isAvailable = availableDate && availableDate <= new Date();
                return (
                  <li key={i} className="px-1 py-2 flex items-center justify-between gap-3" data-testid={`card-entry-${i}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-brand-main">{formatCurrency(h.amount)}</div>
                      <div className="text-[11px] text-txt-secondary">
                        {isAvailable ? (
                          <span className="text-emerald-600 font-semibold">Disponível desde {availableDate?.toLocaleDateString('pt-BR')}</span>
                        ) : availableDate ? (
                          <>Disponível em <b>{availableDate.toLocaleDateString('pt-BR')}</b></>
                        ) : 'Data indisponível'}
                      </div>
                    </div>
                    {isAvailable ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {data.sent_to_card_total > 0 && (
            <div className="mt-3 pt-3 border-t border-border text-xs flex justify-between">
              <span className="text-txt-secondary">Total enviado</span>
              <span className="font-bold">{formatCurrency(data.sent_to_card_total)}</span>
            </div>
          )}
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
          <div className="text-xs text-txt-secondary">Total ganho</div>
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
                  <th className="text-center p-3">Cartão</th>
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
                    <td className="p-3 text-center">
                      {c.sent_to_card ? (
                        <Badge variant="success">Enviado</Badge>
                      ) : c.status === 'paid' ? (
                        <Badge variant="warning">Na conta</Badge>
                      ) : (
                        <span className="text-xs text-txt-secondary">—</span>
                      )}
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
