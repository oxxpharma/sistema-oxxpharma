import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  User, UserX, Search, Package, Trash2, Plus, Minus, Truck, Store,
  CreditCard, QrCode, FileText, ShieldOff, ZapOff, Loader2, ShoppingCart,
} from 'lucide-react';

/**
 * PDV / Frente de caixa (Iter 53)
 *
 * Fluxo em 4 blocos:
 *  1. Cliente: usuario cadastrado (busca) OU manual (form completo).
 *  2. Produtos: busca, add item, escolher tier de preco por item.
 *  3. Frete: valor manual, gratis ou retirada.
 *  4. Pagamento: cartao / cartao parcelado / pix + obs.
 *  Extras: obs do pedido, skip Maxx, skip pontos.
 */

const PAYMENT_METHODS = [
  { key: 'card', label: 'Cartão', icon: CreditCard },
  { key: 'card_installments', label: 'Cartão Parcelado', icon: CreditCard },
  { key: 'pix', label: 'Pix', icon: QrCode },
];

const emptyCustomer = () => ({
  name: '', email: '', cpf: '', phone: '',
  address: { label: 'Balcão', name: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '' },
});

// ---------- Sub-componente: seletor de tier por item ----------
function ItemPriceSelect({ product, item, onChange }) {
  const tiers = product?.pricing_tiers || [];
  const options = useMemo(() => {
    const arr = [{ key: 'base', label: 'Preço base', price: Number(product?.price || 0) }];
    tiers.forEach((t, i) => {
      arr.push({
        key: `tier:${i}`,
        label: t.label || `${t.type || 'tier'}${t.network_type ? ' (' + t.network_type + ')' : ''}`,
        price: Number(t.price || 0),
      });
    });
    arr.push({ key: 'custom', label: 'Personalizado…', price: null });
    return arr;
  }, [product, tiers]);
  const selected = item.tier_key || (item.unit_price != null ? 'custom' : 'base');
  const pickTier = (key) => {
    if (key === 'custom') {
      onChange({ tier_key: 'custom', unit_price: item.unit_price ?? Number(product?.price || 0) });
    } else {
      const opt = options.find(o => o.key === key);
      onChange({ tier_key: key, unit_price: opt?.price });
    }
  };
  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      <select
        value={selected}
        onChange={(e) => pickTier(e.target.value)}
        className="w-full px-2 py-1.5 border border-border rounded-md text-xs font-semibold bg-white"
        data-testid={`pdv-item-tier-${item.product_id}`}
      >
        {options.map(o => (
          <option key={o.key} value={o.key}>
            {o.label}{o.price != null ? ` — ${formatCurrency(o.price)}` : ''}
          </option>
        ))}
      </select>
      {selected === 'custom' && (
        <input
          type="number"
          step="0.01" min="0"
          value={item.unit_price ?? ''}
          onChange={(e) => onChange({ unit_price: e.target.value === '' ? '' : Number(e.target.value) })}
          className="w-full px-2 py-1.5 border border-amber-400 bg-amber-50 rounded-md text-xs font-bold text-amber-900"
          placeholder="Preço personalizado"
          data-testid={`pdv-item-custom-price-${item.product_id}`}
        />
      )}
    </div>
  );
}

// ---------- Sub-componente: busca de usuario ----------
function UserSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await api.get(`/api/admin/users?search=${encodeURIComponent(q)}&limit=8`);
        setResults(d.users || []);
        setOpen(true);
      } catch { /* noop */ }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-border rounded-lg bg-white px-3 py-2">
        <Search className="w-4 h-4 text-txt-secondary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar por nome ou e-mail…"
          className="flex-1 outline-none text-sm bg-transparent"
          data-testid="pdv-user-search"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-txt-secondary" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-white border border-border rounded-lg shadow-lg">
          {results.map(u => (
            <button
              key={u.user_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(u); setQ(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-bg-secondary border-b border-border last:border-b-0"
              data-testid={`pdv-user-result-${u.user_id}`}
            >
              <div className="font-semibold text-sm">{u.name}</div>
              <div className="text-xs text-txt-secondary truncate">
                {u.email} {u.cpf ? `· ${u.cpf}` : ''} {u.phone ? `· ${u.phone}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Sub-componente: busca de produto ----------
function ProductSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const d = await api.get(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
        setResults(d.products || d.items || []);
        setOpen(true);
      } catch { /* noop */ }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-border rounded-lg bg-white px-3 py-2">
        <Package className="w-4 h-4 text-txt-secondary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar produto por nome ou SKU…"
          className="flex-1 outline-none text-sm bg-transparent"
          data-testid="pdv-product-search"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-white border border-border rounded-lg shadow-lg">
          {results.map(p => (
            <button
              key={p.product_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(p); setQ(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-bg-secondary border-b border-border last:border-b-0"
              data-testid={`pdv-product-result-${p.product_id}`}
            >
              <div className="font-semibold text-sm">{p.name}</div>
              <div className="text-xs text-txt-secondary">
                {formatCurrency(p.price)} · Estoque: {p.stock} {p.sku ? ` · ${p.sku}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Página principal ----------
export default function AdminPDV() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null); // { user_id, ... } ou null (guest)
  const [customer, setCustomer] = useState(emptyCustomer());
  const [productMap, setProductMap] = useState({}); // product_id -> product doc
  const [items, setItems] = useState([]); // {product_id, quantity, tier_key, unit_price?}
  const [shipping, setShipping] = useState({ mode: 'value', value: 0, service_name: '' });
  const [payment, setPayment] = useState({ method: 'pix', installments: 2, notes: '' });
  const [orderNotes, setOrderNotes] = useState('');
  const [skipMaxx, setSkipMaxx] = useState(false);
  const [skipPoints, setSkipPoints] = useState(false);
  const [markPaid, setMarkPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  const pickUser = (u) => {
    setUser(u);
    setCustomer({
      name: u.name || '',
      email: u.email || '',
      cpf: u.cpf || '',
      phone: u.phone || '',
      address: u.addresses?.find(a => a.is_default) || u.addresses?.[0] || emptyCustomer().address,
    });
  };
  const clearUser = () => { setUser(null); setCustomer(emptyCustomer()); };

  const addProduct = (p) => {
    setProductMap(m => ({ ...m, [p.product_id]: p }));
    setItems(cur => {
      const existing = cur.find(it => it.product_id === p.product_id);
      if (existing) {
        return cur.map(it => it.product_id === p.product_id ? { ...it, quantity: it.quantity + 1 } : it);
      }
      return [...cur, { product_id: p.product_id, quantity: 1, tier_key: 'base', unit_price: Number(p.price || 0) }];
    });
  };
  const updateItem = (pid, patch) => {
    setItems(cur => cur.map(it => it.product_id === pid ? { ...it, ...patch } : it));
  };
  const removeItem = (pid) => setItems(cur => cur.filter(it => it.product_id !== pid));

  const subtotal = items.reduce((acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0), 0);
  const shippingCost = shipping.mode === 'value' ? Number(shipping.value || 0) : 0;
  const total = subtotal + shippingCost;

  const submit = useCallback(async () => {
    if (!customer.name || (!user && !customer.name.trim())) { toast.error('Nome do cliente é obrigatório'); return; }
    if (items.length === 0) { toast.error('Adicione ao menos 1 produto'); return; }
    if (shipping.mode !== 'pickup' && !user && !customer.address?.zip_code) {
      if (!window.confirm('Cliente sem endereço/CEP e frete não é retirada. Continuar mesmo assim?')) return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user?.user_id || null,
        customer: {
          name: customer.name.trim(),
          email: customer.email.trim(),
          cpf: customer.cpf.trim(),
          phone: customer.phone.trim(),
          address: shipping.mode === 'pickup' ? null : (customer.address || null),
        },
        items: items.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          tier_key: it.tier_key || null,
        })),
        shipping: {
          mode: shipping.mode,
          value: Number(shipping.value || 0),
          service_name: shipping.service_name || null,
        },
        payment: {
          method: payment.method,
          installments: payment.method === 'card_installments' ? Number(payment.installments || 2) : null,
          notes: payment.notes || '',
        },
        order_notes: orderNotes,
        skip_maxx_sync: skipMaxx,
        skip_points: skipPoints,
        mark_paid: markPaid,
      };
      const res = await api.post('/api/admin/orders/manual', payload);
      toast.success(`Pedido criado: #${(res.order_id || '').slice(-8).toUpperCase()}`);
      navigate('/backoffice/pedidos');
    } catch (err) {
      toast.error(err.message || 'Falha ao criar pedido');
    } finally { setSaving(false); }
  }, [user, customer, items, shipping, payment, orderNotes, skipMaxx, skipPoints, markPaid, navigate]);

  return (
    <div className="space-y-5" data-testid="admin-pdv">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-brand-main" />
            PDV — Novo pedido manual
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Frente de caixa: use para vendas no balcão, ajustes ou pedidos manuais. Não gera link de pagamento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* CLIENTE */}
          <section className="bg-white border border-border rounded-xl p-5" data-testid="pdv-customer-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold flex items-center gap-2">
                {user ? <User className="w-5 h-5 text-emerald-600" /> : <UserX className="w-5 h-5 text-amber-600" />}
                Cliente
              </h2>
              {user ? (
                <Button variant="outline" size="sm" onClick={clearUser} data-testid="pdv-clear-user">Trocar</Button>
              ) : null}
            </div>
            {!user ? (
              <>
                <UserSearch onPick={pickUser} />
                <div className="mt-3 p-3 bg-bg-secondary rounded-lg text-xs text-txt-secondary">
                  Não achou o cliente? Preencha os dados abaixo para gerar o pedido <b>sem vincular a uma conta</b>.
                  Os dados ficam salvos como snapshot no pedido.
                </div>
              </>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                <div className="font-bold">{user.name}</div>
                <div className="text-xs text-txt-secondary">{user.email} {user.cpf && `· ${user.cpf}`}</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <Field label="Nome completo *" value={customer.name} onChange={(v) => setCustomer(c => ({ ...c, name: v }))} testid="pdv-cust-name" />
              <Field label="E-mail" type="email" value={customer.email} onChange={(v) => setCustomer(c => ({ ...c, email: v }))} testid="pdv-cust-email" />
              <Field label="CPF" value={customer.cpf} onChange={(v) => setCustomer(c => ({ ...c, cpf: v }))} testid="pdv-cust-cpf" />
              <Field label="Telefone" value={customer.phone} onChange={(v) => setCustomer(c => ({ ...c, phone: v }))} testid="pdv-cust-phone" />
            </div>

            {shipping.mode !== 'pickup' && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase text-txt-secondary mb-2">Endereço de entrega</div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <Field className="md:col-span-4" label="Rua" value={customer.address.street} onChange={(v) => setCustomer(c => ({ ...c, address: { ...c.address, street: v } }))} testid="pdv-addr-street" />
                  <Field className="md:col-span-1" label="Número" value={customer.address.number} onChange={(v) => setCustomer(c => ({ ...c, address: { ...c.address, number: v } }))} testid="pdv-addr-number" />
                  <Field className="md:col-span-1" label="CEP" value={customer.address.zip_code} onChange={(v) => setCustomer(c => ({ ...c, address: { ...c.address, zip_code: v } }))} testid="pdv-addr-zip" />
                  <Field className="md:col-span-2" label="Bairro" value={customer.address.neighborhood} onChange={(v) => setCustomer(c => ({ ...c, address: { ...c.address, neighborhood: v } }))} testid="pdv-addr-neigh" />
                  <Field className="md:col-span-2" label="Complemento" value={customer.address.complement} onChange={(v) => setCustomer(c => ({ ...c, address: { ...c.address, complement: v } }))} testid="pdv-addr-compl" />
                  <Field className="md:col-span-1" label="Cidade" value={customer.address.city} onChange={(v) => setCustomer(c => ({ ...c, address: { ...c.address, city: v } }))} testid="pdv-addr-city" />
                  <Field className="md:col-span-1" label="UF" value={customer.address.state} onChange={(v) => setCustomer(c => ({ ...c, address: { ...c.address, state: v.toUpperCase().slice(0, 2) } }))} testid="pdv-addr-state" />
                </div>
              </div>
            )}
          </section>

          {/* PRODUTOS */}
          <section className="bg-white border border-border rounded-xl p-5" data-testid="pdv-products-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold flex items-center gap-2"><Package className="w-5 h-5 text-brand-main" /> Produtos</h2>
              <span className="text-xs text-txt-secondary">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
            </div>
            <ProductSearch onPick={addProduct} />
            <div className="mt-3 space-y-2">
              {items.length === 0 && (
                <div className="p-4 border border-dashed border-border rounded-lg text-center text-xs text-txt-secondary">
                  Nenhum produto adicionado. Use a busca acima.
                </div>
              )}
              {items.map(it => {
                const p = productMap[it.product_id];
                const line = Number(it.unit_price || 0) * Number(it.quantity || 0);
                return (
                  <div key={it.product_id} className="flex items-start gap-3 p-3 border border-border rounded-lg" data-testid={`pdv-item-row-${it.product_id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{p?.name || it.product_id}</div>
                      <div className="text-[11px] text-txt-secondary">Estoque: {p?.stock ?? '—'} · SKU: {p?.sku || '—'}</div>
                      <div className="mt-2">
                        <ItemPriceSelect
                          product={p}
                          item={it}
                          onChange={(patch) => updateItem(it.product_id, patch)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateItem(it.product_id, { quantity: Math.max(1, it.quantity - 1) })} className="p-1.5 border border-border rounded hover:bg-bg-secondary" data-testid={`pdv-qty-minus-${it.product_id}`}>
                        <Minus className="w-3 h-3" />
                      </button>
                      <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(it.product_id, { quantity: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                        className="w-14 px-1 py-1 text-center border border-border rounded text-sm font-bold" data-testid={`pdv-qty-${it.product_id}`} />
                      <button type="button" onClick={() => updateItem(it.product_id, { quantity: it.quantity + 1 })} className="p-1.5 border border-border rounded hover:bg-bg-secondary" data-testid={`pdv-qty-plus-${it.product_id}`}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-right w-24 shrink-0">
                      <div className="text-sm font-heading font-black">{formatCurrency(line)}</div>
                      <button type="button" onClick={() => removeItem(it.product_id)} className="text-rose-500 hover:text-rose-700 mt-1" data-testid={`pdv-remove-${it.product_id}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* FRETE */}
          <section className="bg-white border border-border rounded-xl p-5" data-testid="pdv-shipping-card">
            <h2 className="font-heading font-bold flex items-center gap-2 mb-3"><Truck className="w-5 h-5 text-brand-main" /> Frete</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'value', label: 'Valor manual', Icon: Truck },
                { key: 'free', label: 'Frete grátis', Icon: Truck },
                { key: 'pickup', label: 'Retirada', Icon: Store },
              ].map(o => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setShipping(s => ({ ...s, mode: o.key }))}
                  className={`px-3 py-3 rounded-lg border-2 font-semibold text-sm flex items-center gap-2 justify-center transition ${shipping.mode === o.key ? 'border-brand-main bg-brand-light text-brand-main' : 'border-border bg-white hover:border-brand-main/50'}`}
                  data-testid={`pdv-shipping-${o.key}`}
                >
                  <o.Icon className="w-4 h-4" />
                  {o.label}
                </button>
              ))}
            </div>
            {shipping.mode === 'value' && (
              <div className="mt-3">
                <Field label="Valor do frete (R$)" type="number" step="0.01" min="0" value={shipping.value}
                  onChange={(v) => setShipping(s => ({ ...s, value: v }))} testid="pdv-shipping-value" />
              </div>
            )}
          </section>

          {/* PAGAMENTO */}
          <section className="bg-white border border-border rounded-xl p-5" data-testid="pdv-payment-card">
            <h2 className="font-heading font-bold flex items-center gap-2 mb-3"><CreditCard className="w-5 h-5 text-brand-main" /> Pagamento</h2>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPayment(p => ({ ...p, method: m.key }))}
                  className={`px-3 py-3 rounded-lg border-2 font-semibold text-sm flex items-center gap-2 justify-center transition ${payment.method === m.key ? 'border-brand-main bg-brand-light text-brand-main' : 'border-border bg-white hover:border-brand-main/50'}`}
                  data-testid={`pdv-payment-${m.key}`}
                >
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </button>
              ))}
            </div>
            {payment.method === 'card_installments' && (
              <div className="mt-3">
                <label className="text-xs font-bold uppercase text-txt-secondary block mb-1">Parcelas</label>
                <select
                  value={payment.installments}
                  onChange={(e) => setPayment(p => ({ ...p, installments: Number(e.target.value) }))}
                  className="w-40 px-3 py-2 border border-border rounded-lg text-sm font-bold"
                  data-testid="pdv-payment-installments"
                >
                  {Array.from({ length: 11 }, (_, i) => i + 2).map(n => (
                    <option key={n} value={n}>{n}x de {formatCurrency(total / n)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-3">
              <label className="text-xs font-bold uppercase text-txt-secondary block mb-1">Observação do pagamento</label>
              <textarea
                value={payment.notes}
                onChange={(e) => setPayment(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                placeholder="Ex.: Cartão da máquina 2, autorização 123456"
                data-testid="pdv-payment-notes"
              />
            </div>
          </section>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <section className="bg-white border border-border rounded-xl p-5 sticky top-4" data-testid="pdv-summary-card">
            <h2 className="font-heading font-bold flex items-center gap-2 mb-3"><FileText className="w-5 h-5 text-brand-main" /> Resumo</h2>
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(subtotal)} />
              <Row label={shipping.mode === 'pickup' ? 'Retirada' : shipping.mode === 'free' ? 'Frete grátis' : 'Frete'} value={formatCurrency(shippingCost)} />
              <div className="border-t border-border pt-2 flex items-baseline justify-between">
                <span className="font-heading font-bold">Total</span>
                <span className="font-heading font-black text-xl text-brand-main" data-testid="pdv-summary-total">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold uppercase text-txt-secondary block mb-1">Observações do pedido</label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                placeholder="Detalhes internos, promessa de entrega, atendente…"
                data-testid="pdv-order-notes"
              />
            </div>

            <div className="mt-4 space-y-2">
              <Toggle
                checked={markPaid}
                onChange={setMarkPaid}
                label="Marcar como PAGO"
                hint="Se desativado, o pedido fica com status pendente"
                testid="pdv-toggle-paid"
                iconColor="text-emerald-600"
              />
              <Toggle
                checked={skipMaxx}
                onChange={setSkipMaxx}
                Icon={ShieldOff}
                label="Não enviar para Maxx"
                hint="Não sincroniza pontos com a API externa"
                testid="pdv-toggle-skip-maxx"
                iconColor="text-amber-600"
              />
              <Toggle
                checked={skipPoints}
                onChange={setSkipPoints}
                Icon={ZapOff}
                label="Não gerar pontuação"
                hint="Não cria logs de pontos e nem cashback dos itens"
                testid="pdv-toggle-skip-points"
                iconColor="text-rose-600"
              />
            </div>

            <Button className="w-full mt-4" onClick={submit} loading={saving} disabled={items.length === 0 || !customer.name.trim()} data-testid="pdv-submit">
              Criar pedido
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------- Utils ----------
function Field({ label, value, onChange, type = 'text', className = '', testid, ...rest }) {
  return (
    <div className={className}>
      <label className="text-xs font-bold uppercase text-txt-secondary block mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm"
        data-testid={testid}
        {...rest}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-txt-secondary">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, testid, Icon, iconColor }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-bg-secondary" data-testid={testid}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-brand-main"
      />
      <div className="flex-1">
        <div className="text-sm font-bold flex items-center gap-1.5">
          {Icon && <Icon className={`w-3.5 h-3.5 ${iconColor || 'text-brand-main'}`} />}
          {label}
        </div>
        {hint && <div className="text-[11px] text-txt-secondary">{hint}</div>}
      </div>
    </label>
  );
}
