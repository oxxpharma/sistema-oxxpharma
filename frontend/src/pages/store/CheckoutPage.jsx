import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useReferral } from '../../contexts/RefContext';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import AddressForm from '../../components/store/AddressForm';
import { MapPin, CreditCard, QrCode, FileText, Share2, Plus, Check, Loader2, Wallet, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import ShippingCalculator, { loadSelectedShipping, saveSelectedShipping } from '../../components/store/ShippingCalculator';
import FreeShippingProgress from '../../components/store/FreeShippingProgress';
import { evaluateFreeShipping } from '../../lib/freeShipping';

const emptyAddr = { label: 'Casa', street: '', number: '', complement: '', neighborhood: '', city: '', state: 'SP', zip_code: '', is_default: true };
const PICKUP_KEY = 'oxx_pickup_v1';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, clear } = useCart();
  const { user } = useAuth();
  const { refCode, refName, clearRef } = useReferral();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState(emptyAddr);
  const [selectedShipping, setSelectedShipping] = useState(() => loadSelectedShipping());
  const settings = useSiteSettings();
  const pickupCfg = settings?.pickup;
  const [pickup, setPickup] = useState(() => localStorage.getItem(PICKUP_KEY) === '1');
  useEffect(() => { localStorage.setItem(PICKUP_KEY, pickup ? '1' : '0'); }, [pickup]);
  useEffect(() => {
    if (pickupCfg && !pickupCfg.enabled && pickup) setPickup(false);
  }, [pickupCfg?.enabled]); // eslint-disable-line
  // Iter 38: Voucher pre-pago vindo da Maxx
  const [voucherBalance, setVoucherBalance] = useState(0);
  const [useVoucher, setUseVoucher] = useState(false);
  // Iter 66 (Convenio): contexto de funcionario + aceite digital do desconto em folha
  const [employeeCtx, setEmployeeCtx] = useState(null);
  const [payrollAccepted, setPayrollAccepted] = useState(false);
  const [payrollEligibility, setPayrollEligibility] = useState(null);
  const [payrollInstallments, setPayrollInstallments] = useState(1);
  // Iter 66.3: bonus de garantia Ozoxx
  const [bonusInfo, setBonusInfo] = useState(null);
  const [bonusUnitsToUse, setBonusUnitsToUse] = useState(0);
  // Iter 66.3: cupom aplicado (para avisar sobre incompatibilidade com desconto convenio)
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const ec = await api.get('/api/me/employee-context');
        setEmployeeCtx(ec);
      } catch { setEmployeeCtx(null); }
    })();
    // detecta cupom aplicado no localStorage
    try {
      const c = JSON.parse(localStorage.getItem('oxx_coupon_v1') || 'null');
      setAppliedCoupon(c);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const v = await api.get('/api/users/me/voucher');
        setVoucherBalance(Number(v?.balance || 0));
      } catch { /* noop */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { addresses: addrs } = await api.get('/api/users/me/addresses');
        setAddresses(addrs || []);
        const def = addrs?.find(a => a.is_default) || addrs?.[0];
        if (def) setSelectedAddr(def.address_id);
        else setShowNewAddr(true);
      } catch {
        setShowNewAddr(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading && !cart.items.length) {
      navigate('/carrinho');
    }
  }, [loading, cart.items.length, navigate]);

  const addAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/users/me/addresses', newAddr);
      setAddresses(res.addresses);
      const last = res.addresses[res.addresses.length - 1];
      setSelectedAddr(last.address_id);
      setShowNewAddr(false);
      toast.success('Endereço adicionado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submit = async () => {
    if (!pickup && !selectedAddr) { toast.error('Selecione um endereço'); return; }
    if (paymentMethod === 'payroll' && !payrollAccepted) {
      toast.error('É necessário aceitar os termos do desconto em folha');
      return;
    }
    setSubmitting(true);
    try {
      let couponCode;
      try {
        const c = JSON.parse(localStorage.getItem('oxx_coupon_v1') || 'null');
        if (c?.code) couponCode = c.code;
      } catch { /* noop */ }
      const order = await api.post('/api/checkout', {
        address_id: pickup ? 'pickup' : selectedAddr,
        payment_method: paymentMethod,
        ref_code: refCode || undefined,
        coupon_code: couponCode,
        voucher_amount: voucherToUse > 0 ? Number(voucherToUse.toFixed(2)) : undefined,
        pickup: pickup || undefined,
        shipping_price: pickup ? 0 : (selectedShipping?.free_shipping ? 0 : (selectedShipping ? Number(selectedShipping.price) : undefined)),
        shipping_service_name: pickup ? 'Retirada no Local' : selectedShipping?.name,
        shipping_carrier: pickup ? 'Local' : selectedShipping?.carrier,
        shipping_service_id: pickup ? 'pickup' : selectedShipping?.id,
        shipping_delivery_days: pickup ? 0 : selectedShipping?.delivery_days,
        payroll_accepted: paymentMethod === 'payroll' ? payrollAccepted : undefined,
        payroll_terms_version: paymentMethod === 'payroll' ? 'v1' : undefined,
        payroll_installments: paymentMethod === 'payroll' ? payrollInstallments : undefined,
        payroll_terms_text: paymentMethod === 'payroll' ? getRenderedTermsText() : undefined,
        warranty_bonus_units: bonusUnitsToUse > 0 ? bonusUnitsToUse : undefined,
      });
      // Iter 66: Desconto em folha ja fica pago no backend
      if (paymentMethod === 'payroll') {
        clear();
        clearRef();
        try { localStorage.removeItem('oxx_coupon_v1'); } catch { /* noop */ }
        try { saveSelectedShipping(null); } catch { /* noop */ }
        toast.success('Pedido registrado! Será descontado na próxima folha de pagamento.');
        navigate(`/pedido/${order.order_id}`);
        return;
      }
      // Cria preferencia de pagamento (ou marca pago direto se voucher cobriu tudo)
      const pay = await api.post(`/api/payments/create/${order.order_id}`);
      clear();
      clearRef();
      try { localStorage.removeItem('oxx_coupon_v1'); } catch { /* noop */ }
      try { saveSelectedShipping(null); } catch { /* noop */ }
      // Iter 38: Pagamento totalmente coberto pelo voucher -> sem redirecionar a MP
      if (pay.provider === 'voucher' || pay.paid) {
        toast.success('Pedido pago com saldo voucher!');
        navigate(`/pedido/${order.order_id}`);
        return;
      }
      // Se gateway ativo (MP ou iPag) tem URL de pagamento externa, redireciona
      if ((pay.provider === 'mercadopago' || pay.provider === 'ipag') && pay.payment_url) {
        toast.success('Redirecionando para o pagamento...');
        window.location.href = pay.payment_url;
        return;
      }
      toast.success('Pedido criado com sucesso!');
      navigate(`/pedido/${order.order_id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const subtotal = cart.subtotal || 0;
  // Iter 42h: helper unificado (suporta multiplas regras OR + legacy)
  const fsEval = evaluateFreeShipping(settings, user, subtotal);
  const isFreeShippingByRule = subtotal > 0 && fsEval.applies;
  const fsThreshold = fsEval.threshold || 0;
  const remainingForFree = fsEval.remaining || 0;
  const shipping = pickup
    ? 0
    : isFreeShippingByRule
      ? 0
      : (selectedShipping?.free_shipping ? 0 : Number(selectedShipping?.price || 0));
  const couponDiscount = (() => {
    try {
      const c = JSON.parse(localStorage.getItem('oxx_coupon_v1') || 'null');
      return Number(c?.discount || 0);
    } catch { return 0; }
  })();
  const grandBeforeVoucher = Math.max(0, subtotal + shipping - couponDiscount);
  // Iter 38: Voucher abate ate o valor total. Se cobrir tudo, total = 0 e nao vai ao MP.
  const voucherToUse = useVoucher ? Math.min(voucherBalance, grandBeforeVoucher) : 0;
  // Iter 66.3: bonus de garantia
  const bonusAmountUsed = bonusUnitsToUse > 0 && bonusInfo?.amount_per_unit
    ? Math.min(bonusUnitsToUse * bonusInfo.amount_per_unit, Math.max(0, grandBeforeVoucher - voucherToUse))
    : 0;
  const total = Math.max(0, grandBeforeVoucher - voucherToUse - bonusAmountUsed);
  const fullyCoveredByVoucher = useVoucher && voucherToUse >= grandBeforeVoucher && grandBeforeVoucher > 0;

  // Iter 66: checa elegibilidade de parcelamento em folha
  useEffect(() => {
    if (employeeCtx && total > 0) {
      (async () => {
        try {
          const el = await api.post('/api/checkout/payroll-eligibility', { amount: total, installments: payrollInstallments });
          setPayrollEligibility(el);
        } catch { setPayrollEligibility(null); }
      })();
    } else {
      setPayrollEligibility(null);
    }
  }, [employeeCtx, total, payrollInstallments]);

  // Iter 66.3: recarrega bonus quando subtotal muda
  useEffect(() => {
    (async () => {
      if (subtotal <= 0) { setBonusInfo(null); return; }
      try {
        const b = await api.get(`/api/me/warranty-bonus?subtotal=${subtotal}`);
        setBonusInfo(b);
        // reset se ficou acima do disponivel
        if (bonusUnitsToUse > b.usable_units) setBonusUnitsToUse(0);
      } catch { setBonusInfo(null); }
    })();
    // eslint-disable-next-line
  }, [subtotal]);

  const getRenderedTermsText = () => {
    if (!employeeCtx) return '';
    const template = employeeCtx.payroll_terms_text || '';
    const empName = employeeCtx.employee_name || user?.name || 'N/A';
    const cpfVal = employeeCtx.cpf || user?.cpf || 'N/A';
    const matVal = employeeCtx.registration_number || employeeCtx.matricula || 'Não informada';
    const compName = employeeCtx.company_name || 'N/A';
    const compCnpj = employeeCtx.company_cnpj || 'N/A';
    const totFmt = formatCurrency(total);
    const instAmt = total / (payrollInstallments || 1);
    const instFmt = `${payrollInstallments}x de ${formatCurrency(instAmt)} (Total: ${totFmt})`;
    const dateFmt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    return template
      .replace(/@nomecompleto|@nome|\{nomecompleto\}|\{nome\}/g, empName)
      .replace(/@cpf|\{cpf\}/g, cpfVal)
      .replace(/@matricula|@matriculafuncional|\{matricula\}/g, matVal)
      .replace(/@empresa|@razaosocial|\{empresa\}/g, compName)
      .replace(/@cnpj|\{cnpj\}/g, compCnpj)
      .replace(/@valor|\{valor\}/g, totFmt)
      .replace(/@parcelas|\{parcelas\}/g, instFmt)
      .replace(/@datahora|@data|\{data\}/g, dateFmt);
  };

  // CEP do endereço selecionado (para auto-cotação ao entrar no checkout / trocar endereço)
  const selectedAddrObj = addresses.find(a => a.address_id === selectedAddr);
  const selectedAddrCep = selectedAddrObj?.zip_code || '';

  // Iter 45: GARANTIA de CPF e CEP - exigidos antes do checkout
  const userCpfDigits = (user?.cpf_digits || (user?.cpf || '').replace(/\D/g, '') || '');
  const hasCpf = userCpfDigits.length >= 11;
  const selectedAddrZipDigits = (selectedAddrObj?.zip_code || '').replace(/\D/g, '');
  const hasValidCep = selectedAddrZipDigits.length === 8;
  // Iter 47: pickup nao exige endereco selecionado (usa endereco da loja)
  const canCheckout = hasCpf && (pickup || (hasValidCep && selectedAddr));

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="checkout-page">
      <h1 className="font-heading font-black text-3xl text-txt-primary mb-6">Finalizar compra</h1>

      {refName && (
        <div className="bg-brand-light border border-brand-main/20 rounded-xl p-4 flex items-center gap-3 mb-6" data-testid="checkout-ref-info">
          <Share2 className="w-5 h-5 text-brand-main" />
          <div className="text-sm">
            <div className="font-semibold text-brand-main">Compra indicada por {refName}</div>
            <div className="text-xs text-txt-secondary">Sua compra gerará cashback para o afiliado.</div>
          </div>
        </div>
      )}

      {/* Iter 45: bloqueio claro quando CPF nao esta no cadastro */}
      {!hasCpf && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 flex items-start gap-3 mb-6" data-testid="checkout-need-cpf">
          <FileText className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <div className="font-bold text-rose-700">CPF obrigatório para finalizar a compra</div>
            <div className="text-rose-700/80 text-xs mt-1">
              Precisamos do seu CPF para emitir corretamente a nota e o pedido.
            </div>
          </div>
          <Link to="/minha-conta" className="text-xs font-bold bg-rose-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap" data-testid="checkout-fill-cpf-btn">
            Cadastrar CPF
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Iter 47: Toggle Retirada no Local */}
          {pickupCfg?.enabled && (
            <section className="bg-white rounded-xl border-2 border-orange-200 p-5" data-testid="checkout-pickup-section">
              <button
                type="button"
                onClick={() => setPickup(!pickup)}
                className={`w-full text-left p-3 rounded-lg border-2 transition flex items-start gap-3 ${pickup ? 'border-orange-500 bg-orange-50' : 'border-border hover:border-orange-400/60'}`}
                data-testid="toggle-pickup-checkout"
              >
                <Store className={`w-6 h-6 shrink-0 mt-0.5 ${pickup ? 'text-orange-600' : 'text-txt-secondary'}`} />
                <div className="flex-1">
                  <div className="font-bold text-sm flex items-center gap-2">
                    🏬 Quero retirar no local
                    {pickup && <span className="text-[10px] uppercase font-black bg-orange-600 text-white px-1.5 py-0.5 rounded">selecionado · frete grátis</span>}
                  </div>
                  <div className="text-xs text-txt-secondary mt-0.5">Sem custo de envio. Você retira o pedido na loja.</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 ${pickup ? 'border-orange-600 bg-orange-600' : 'border-gray-300'}`}>
                  {pickup && <div className="w-full h-full rounded-full border-2 border-white" />}
                </div>
              </button>

              {pickup && (
                <div className="mt-4 bg-orange-50/50 border border-orange-200 rounded-lg p-4 text-sm space-y-2" data-testid="pickup-info-checkout">
                  <div className="font-bold text-orange-700 flex items-center gap-2"><MapPin className="w-4 h-4" /> Local de retirada</div>
                  <div className="text-txt-primary font-medium">{pickupCfg.address}</div>
                  {pickupCfg.hours && <div className="text-txt-secondary"><span className="font-semibold">⏰ Horário:</span> {pickupCfg.hours}</div>}
                  {pickupCfg.phone && <div className="text-txt-secondary"><span className="font-semibold">📞 Telefone:</span> {pickupCfg.phone}</div>}
                  {pickupCfg.instructions && <div className="text-txt-secondary italic">{pickupCfg.instructions}</div>}
                  <div className="mt-3 pt-3 border-t border-orange-200 flex items-start gap-2 text-xs text-amber-900 bg-amber-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                    <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                    <span><strong>Importante:</strong> apresente a fatura recebida por e-mail (após a confirmação do pagamento) no ato da retirada.</span>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Endereço (oculto quando pickup) */}
          {!pickup && (
          <section className="bg-white rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-black text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-main" /> Endereço de entrega</h2>
              {addresses.length > 0 && !showNewAddr && (
                <button onClick={() => setShowNewAddr(true)} className="text-sm text-brand-main font-semibold flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Novo endereço
                </button>
              )}
            </div>

            {!showNewAddr && addresses.length > 0 && (
              <div className="space-y-2" data-testid="addresses-list">
                {addresses.map(a => (
                  <button
                    key={a.address_id}
                    onClick={() => setSelectedAddr(a.address_id)}
                    className={`w-full text-left p-4 rounded-lg border transition ${selectedAddr === a.address_id ? 'border-brand-main bg-brand-light/50' : 'border-border hover:border-brand-main/40'}`}
                    data-testid={`addr-${a.address_id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-sm text-txt-primary">{a.label || 'Endereço'}</div>
                        <div className="text-sm text-txt-secondary mt-0.5">
                          {a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ''} · {a.neighborhood}
                        </div>
                        <div className="text-sm text-txt-secondary">{a.city}/{a.state} · CEP {a.zip_code}</div>
                      </div>
                      {selectedAddr === a.address_id && <Check className="w-5 h-5 text-brand-main flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showNewAddr && (
              <form onSubmit={addAddress} className="space-y-3" data-testid="new-addr-form">
                <AddressForm value={newAddr} onChange={setNewAddr} showDefault={false} />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" data-testid="save-addr-btn">Salvar endereço</Button>
                  {addresses.length > 0 && (
                    <Button type="button" variant="ghost" onClick={() => setShowNewAddr(false)}>Cancelar</Button>
                  )}
                </div>
              </form>
            )}
          </section>
          )}

          {/* Pagamento */}
          <section className="bg-white rounded-xl border border-border p-6">
            <h2 className="font-heading font-black text-lg mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-brand-main" /> Forma de pagamento</h2>

            {/* Iter 38: Saldo Voucher pre-pago */}
            {voucherBalance > 0 && (
              <div
                className={`mb-4 rounded-xl border p-4 transition ${useVoucher ? 'border-emerald-400 bg-emerald-50' : 'border-border bg-bg-secondary/40'}`}
                data-testid="voucher-card"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${useVoucher ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-bold text-sm">Saldo Voucher disponível</div>
                      <div className="font-heading font-black text-emerald-600 text-lg" data-testid="voucher-balance">
                        {formatCurrency(voucherBalance)}
                      </div>
                    </div>
                    <p className="text-xs text-txt-secondary mt-0.5">
                      Use seu saldo pré-pago para abater do total. Se não cobrir tudo, o restante é cobrado pelo Mercado Pago.
                    </p>
                    <label className="mt-3 flex items-center gap-2 cursor-pointer select-none" data-testid="voucher-toggle-label">
                      <input
                        type="checkbox"
                        checked={useVoucher}
                        onChange={(e) => setUseVoucher(e.target.checked)}
                        className="w-4 h-4 accent-emerald-500"
                        data-testid="voucher-toggle"
                      />
                      <span className="text-sm font-semibold">
                        Usar saldo voucher neste pedido
                      </span>
                    </label>
                    {useVoucher && (
                      <div className="mt-2 text-xs bg-white rounded-lg border border-emerald-200 p-2">
                        <div className="flex justify-between">
                          <span className="text-txt-secondary">Voucher aplicado</span>
                          <span className="font-bold text-emerald-600">−{formatCurrency(voucherToUse)}</span>
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-txt-secondary">Restante a pagar</span>
                          <span className="font-bold">{formatCurrency(total)}</span>
                        </div>
                        {fullyCoveredByVoucher && (
                          <div className="mt-1 text-emerald-700 font-semibold">
                            ✓ Voucher cobre todo o pedido — sem cobrança no cartão.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!fullyCoveredByVoucher && (
              <div className="space-y-2">
              {[
                { id: 'pix', icon: QrCode, name: 'PIX', desc: 'Pagamento instantâneo' },
                { id: 'credit_card', icon: CreditCard, name: 'Cartão de crédito', desc: 'Parcele em até 6x' },
                { id: 'boleto', icon: FileText, name: 'Boleto bancário', desc: 'Vence em 3 dias úteis' },
                ...(employeeCtx?.payroll_enabled ? [{
                  id: 'payroll', icon: Wallet, name: 'Desconto em folha',
                  desc: `Convênio · ${employeeCtx.company_name} · limite disponível: ${formatCurrency(employeeCtx.available_limit)}`
                }] : []),
              ].map(pm => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`w-full text-left p-4 rounded-lg border transition flex items-center gap-3 ${paymentMethod === pm.id ? 'border-brand-main bg-brand-light/50' : 'border-border hover:border-brand-main/40'}`}
                  data-testid={`pm-${pm.id}`}
                >
                  <pm.icon className="w-5 h-5 text-brand-main" />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{pm.name}</div>
                    <div className="text-xs text-txt-secondary">{pm.desc}</div>
                  </div>
                  {paymentMethod === pm.id && <Check className="w-5 h-5 text-brand-main" />}
                </button>
              ))}

              {/* Iter 66 (Convenio): Desconto em folha com Parcelamento */}
              {paymentMethod === 'payroll' && employeeCtx && (
                <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-4" data-testid="payroll-consent-box">
                  <div className="flex justify-between items-center border-b border-emerald-200/60 pb-2">
                    <div className="text-sm font-bold text-emerald-950">
                      💳 Desconto em folha — {employeeCtx.company_name}
                    </div>
                    <span className="text-[11px] bg-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                      Cartão Consignado
                    </span>
                  </div>

                  {/* Resumo dos Limites */}
                  <div className="grid sm:grid-cols-2 gap-2 text-xs bg-white rounded-lg p-3 border border-emerald-200 shadow-sm">
                    <div>
                      <div className="text-txt-secondary font-medium">Margem Mensal (30% salário):</div>
                      <div className="text-emerald-700 font-bold">
                        {formatCurrency(employeeCtx.available_monthly_margin)} <span className="font-normal text-[10px] text-txt-secondary">disponível</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-txt-secondary font-medium">Limite Total Acumulado:</div>
                      <div className="text-blue-700 font-bold">
                        {formatCurrency(employeeCtx.available_total_limit)} <span className="font-normal text-[10px] text-txt-secondary">disponível</span>
                      </div>
                    </div>
                  </div>

                  {/* Seleção de Parcelamento */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-txt-primary">
                      Opções de Parcelamento em Folha:
                    </label>
                    <select
                      value={payrollInstallments}
                      onChange={e => setPayrollInstallments(parseInt(e.target.value, 10))}
                      className="w-full bg-white border border-border rounded-lg p-2.5 text-xs font-semibold text-txt-primary shadow-sm focus:ring-2 focus:ring-emerald-500"
                      data-testid="payroll-installments-select"
                    >
                      {(payrollEligibility?.installment_options || Array.from({ length: 12 }, (_, i) => {
                        const n = i + 1;
                        const instAmt = total / n;
                        const ok = instAmt <= (employeeCtx.available_monthly_margin || 0) && total <= (employeeCtx.available_total_limit || 0);
                        return { installments: n, installment_amount: instAmt, eligible: ok };
                      })).map(opt => {
                        const instVal = formatCurrency(opt.installment_amount);
                        let label = `${opt.installments}x de ${instVal} (Total: ${formatCurrency(total)})`;
                        if (!opt.eligible) {
                          if (opt.reason === 'exceeds_monthly_margin') label += ` — Excede margem mensal (${formatCurrency(employeeCtx.available_monthly_margin)}/mês)`;
                          else if (opt.reason === 'exceeds_total_limit') label += ` — Excede limite total (${formatCurrency(employeeCtx.available_total_limit)})`;
                          else label += ` — Excede limite de margem/total`;
                        } else {
                          label += ` · Sem juros`;
                        }
                        return (
                          <option key={opt.installments} value={opt.installments} disabled={!opt.eligible}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Caixa de Exibição dos Termos de Adesão com Variáveis Preenchidas */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" /> Termo de Adesão e Autorização de Desconto
                    </div>
                    <div className="bg-white border border-emerald-300 rounded-lg p-3 max-h-48 overflow-y-auto text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-800 shadow-inner select-text" data-testid="payroll-terms-box">
                      {getRenderedTermsText()}
                    </div>
                  </div>

                  {/* Status & Validação */}
                  {payrollEligibility && !payrollEligibility.eligible ? (
                    <div className="text-xs text-red-700 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200 flex items-center gap-2">
                      <span>⚠️</span>
                      <span>
                        {payrollEligibility.reason === 'exceeds_monthly_margin' && `A parcela excede sua margem mensal de ${formatCurrency(employeeCtx.available_monthly_margin)}.`}
                        {payrollEligibility.reason === 'exceeds_total_limit' && `O valor total excede o seu limite total acumulado de ${formatCurrency(employeeCtx.available_total_limit)}.`}
                        {payrollEligibility.reason === 'exceeds_both' && `O parcelamento selecionado excede seus limites de margem e total.`}
                        {!payrollEligibility.reason && `Escolha outro parcelamento ou método de pagamento.`}
                      </span>
                    </div>
                  ) : (
                    <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none bg-white p-3 rounded-lg border border-emerald-300 shadow-sm hover:border-emerald-400 transition" data-testid="payroll-accept-label">
                      <input
                        type="checkbox"
                        checked={payrollAccepted}
                        onChange={e => setPayrollAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-emerald-600 rounded"
                        data-testid="payroll-accept"
                      />
                      <span className="text-slate-800 font-medium leading-normal">
                        Li integralmente, concordo e <b>AUTORIZO EXPRESSAMENTE</b> o desconto em folha de <b>{payrollInstallments}x de {formatCurrency(total / payrollInstallments)}</b> (total: {formatCurrency(total)}) pela empresa <b>{employeeCtx.company_name}</b>, conforme o Termo de Adesão acima.
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Iter 66.3: aviso Convenio + Cupom incompativel */}
              {employeeCtx && employeeCtx.discount_percent > 0 && appliedCoupon?.code && (
                <div className="mt-3 rounded-xl border border-orange-300 bg-orange-50 p-3 text-xs text-orange-800" data-testid="convenio-coupon-warning">
                  ⚠️ <b>Cupom {appliedCoupon.code} aplicado:</b> o desconto do convênio ({employeeCtx.discount_percent}% de <b>{employeeCtx.company_name}</b>) foi pausado. Remova o cupom no carrinho para reativar o desconto do convênio.
                </div>
              )}
              {employeeCtx && employeeCtx.discount_percent > 0 && !appliedCoupon?.code && (
                <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800" data-testid="convenio-discount-info">
                  ✓ Desconto do convênio <b>{employeeCtx.company_name}</b> ({employeeCtx.discount_percent}%) aplicado
                  {employeeCtx.discount_max_units ? ` em até ${employeeCtx.discount_max_units} unidade(s) por pedido` : ''}. Cupom desabilita o desconto do convênio.
                </div>
              )}

              {/* Iter 66.3: Bonus de Garantia Ozoxx */}
              {bonusInfo && bonusInfo.available_units > 0 && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4" data-testid="warranty-bonus-box">
                  <div className="flex items-center gap-2 mb-1"><span className="text-amber-600 text-lg">🎁</span><b className="text-sm">Bônus de Garantia Ozoxx</b></div>
                  <div className="text-xs text-txt-secondary mb-2">
                    Você tem <b>{bonusInfo.available_units}</b> aparelho(s) registrado(s) — bônus de R$ {bonusInfo.amount_per_unit.toFixed(2)} em compras a cada R$ {bonusInfo.min_order_per_unit.toFixed(2)}.
                  </div>
                  <div className="text-xs mb-2">
                    Nesta compra você pode usar até <b className="text-emerald-700">{bonusInfo.usable_units} bônus (R$ {bonusInfo.amount.toFixed(2)})</b>.
                    {bonusInfo.min_next_tier && (
                      <div className="text-amber-700">Adicione mais R$ {bonusInfo.remaining_for_next.toFixed(2)} para desbloquear +1 bônus.</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs">Usar bônus:</label>
                    <select className="text-xs border border-border rounded px-2 py-1" value={bonusUnitsToUse} onChange={e => setBonusUnitsToUse(parseInt(e.target.value, 10))} data-testid="bonus-select">
                      {Array.from({ length: bonusInfo.usable_units + 1 }, (_, i) => i).map(n => (
                        <option key={n} value={n}>{n === 0 ? 'Não usar' : `${n} bônus (R$ ${(n * bonusInfo.amount_per_unit).toFixed(2)})`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            )}
            <p className="text-xs text-txt-secondary mt-3 bg-bg-secondary p-3 rounded-lg">
              <strong>Nota:</strong> {fullyCoveredByVoucher
                ? 'Como o saldo voucher cobre todo o pedido, nenhuma cobrança será feita no cartão.'
                : 'O pagamento será processado via Mercado Pago.'}
            </p>
          </section>
        </div>

        {/* Resumo */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-border p-6 sticky top-24" data-testid="checkout-summary">
            <h2 className="font-heading font-black text-lg mb-4">Resumo</h2>
            <div className="max-h-48 overflow-y-auto space-y-2 pb-3 border-b border-border">
              {cart.items.map(it => (
                <div key={it.product_id} className="flex gap-2 text-xs">
                  <img src={it.image || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=100'} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{it.name}</div>
                    <div className="text-txt-secondary">{it.quantity}x {formatCurrency(it.price)}</div>
                  </div>
                  <div className="font-bold">{formatCurrency(it.total)}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 py-3 text-sm">
              <div className="flex justify-between"><span className="text-txt-secondary">Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>

              {/* Calculadora de frete (auto-calcula pelo CEP do endereço selecionado) */}
              {!pickup && !isFreeShippingByRule && selectedAddr && (
                <div className="pt-2 pb-2">
                  <ShippingCalculator
                    items={cart.items}
                    subtotal={subtotal}
                    initialCep={selectedAddrCep}
                    readOnlyCep
                    autoCalculate
                    onSelect={(opt) => setSelectedShipping(opt)}
                  />
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-txt-secondary">Frete</span>
                {pickup ? (
                  <span className="font-semibold text-orange-600">Retirada no local</span>
                ) : isFreeShippingByRule ? (
                  <span className="font-semibold text-emerald-600">{settings?.free_shipping_label || 'Frete grátis'}</span>
                ) : selectedShipping ? (
                  <span>
                    {selectedShipping.free_shipping ? (
                      <span className="text-emerald-600 font-semibold">{selectedShipping.free_shipping_label || 'Grátis'}</span>
                    ) : formatCurrency(shipping)}
                    <span className="text-[11px] text-txt-secondary ml-1">({selectedShipping.name})</span>
                  </span>
                ) : (
                  <span className="text-xs text-txt-secondary">selecione uma opção</span>
                )}
              </div>

              {(remainingForFree > 0 || isFreeShippingByRule) && subtotal > 0 && fsThreshold > 0 && (
                <FreeShippingProgress
                  subtotal={subtotal}
                  threshold={fsThreshold}
                  remaining={remainingForFree}
                  applies={isFreeShippingByRule}
                  label={settings?.free_shipping_label || 'Frete grátis'}
                  compact
                />
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Cupom</span><span className="font-semibold">−{formatCurrency(couponDiscount)}</span></div>
              )}
              {voucherToUse > 0 && (
                <div className="flex justify-between text-emerald-600" data-testid="summary-voucher-line">
                  <span>Voucher aplicado</span>
                  <span className="font-semibold">−{formatCurrency(voucherToUse)}</span>
                </div>
              )}
              {bonusAmountUsed > 0 && (
                <div className="flex justify-between text-amber-700" data-testid="summary-bonus-line">
                  <span>Bônus garantia ({bonusUnitsToUse}×)</span>
                  <span className="font-semibold">−{formatCurrency(bonusAmountUsed)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-baseline pt-3 border-t border-border">
              <span className="font-bold">Total</span>
              <span className="font-heading font-black text-2xl text-brand-main">{formatCurrency(total)}</span>
            </div>
            <Button onClick={submit} loading={submitting} className="w-full mt-5" size="lg" data-testid="confirm-order-btn" disabled={!canCheckout || (!pickup && !isFreeShippingByRule && !selectedShipping)}>
              Confirmar pedido
            </Button>
            {!canCheckout && (
              <div className="mt-3 text-[11px] text-rose-600 font-semibold text-center" data-testid="checkout-block-reason">
                {!hasCpf
                  ? 'É preciso cadastrar seu CPF antes de finalizar o pedido.'
                  : !hasValidCep
                    ? 'O endereço selecionado está sem CEP válido (8 dígitos).'
                    : 'Selecione um endereço de entrega.'}
              </div>
            )}
            <Link to="/carrinho" className="block text-center mt-3 text-xs text-txt-secondary">Voltar ao carrinho</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
