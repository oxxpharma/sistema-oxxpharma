import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Printer, ArrowLeft, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import BrandLogo from '../../components/branding/BrandLogo';

export default function InvoicePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get(`/api/orders/${id}/invoice`);
        setData(d);
      } catch (err) {
        toast.error(err.message);
      } finally { setLoading(false); }
    })();
  }, [id]);

  const print = () => window.print();

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  if (!data) return <div className="p-10 text-center">Nota não disponível.</div>;

  const { company, buyer, order, invoice_number, invoice_issued_at } = data;
  const addr = order.shipping_address || {};

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8" data-testid="invoice-page">
      {/* Toolbar (escondido na impressão) */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Link to={-1} className="inline-flex items-center gap-1 text-sm text-txt-secondary hover:text-brand-main">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <Button onClick={print} data-testid="print-invoice-btn"><Printer className="w-4 h-4" /> Imprimir / Salvar PDF</Button>
      </div>

      {/* Documento */}
      <div className="bg-white rounded-xl border border-border p-8 md:p-12 print:border-0 print:rounded-none print:shadow-none invoice-doc">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-6 border-b-2 border-gray-900">
          <div className="flex items-center gap-3">
            <BrandLogo slot="invoice" variant="light" textClassName="font-heading font-black text-2xl leading-tight" />
            <div>
              {company.cnpj && <div className="text-xs text-txt-secondary">CNPJ: {company.cnpj}</div>}
              {company.address && <div className="text-xs text-txt-secondary">{company.address} {company.city && `· ${company.city}/${company.state}`} {company.zip && `· ${company.zip}`}</div>}
              {(company.phone || company.email) && <div className="text-xs text-txt-secondary">{company.phone} {company.phone && company.email ? '·' : ''} {company.email}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-brand-main bg-brand-light px-3 py-1 rounded-full">
              <FileText className="w-3 h-3" /> Nota de faturamento
            </div>
            <div className="font-mono font-black text-2xl mt-2" data-testid="invoice-number">{invoice_number}</div>
            <div className="text-xs text-txt-secondary mt-1">Emissão: {formatDateTime(invoice_issued_at)}</div>
            <div className="text-xs text-txt-secondary">Pedido: #{order.order_id.slice(-8).toUpperCase()}</div>
          </div>
        </div>

        {/* Cliente */}
        <div className="grid md:grid-cols-2 gap-6 py-6 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-txt-secondary font-bold mb-1">Cliente</div>
            <div className="font-bold text-sm">{buyer.name}</div>
            {buyer.cpf && <div className="text-xs">CPF: {buyer.cpf}</div>}
            <div className="text-xs">{buyer.email}</div>
            {buyer.phone && <div className="text-xs">{buyer.phone}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-txt-secondary font-bold mb-1">Entrega</div>
            <div className="text-sm">{addr.street}, {addr.number}{addr.complement ? ` · ${addr.complement}` : ''}</div>
            <div className="text-xs">{addr.neighborhood} · {addr.city}/{addr.state}</div>
            <div className="text-xs">CEP {addr.zip_code}</div>
          </div>
        </div>

        {/* Items */}
        <div className="py-6">
          <div className="text-[10px] uppercase tracking-widest text-txt-secondary font-bold mb-3">Itens</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-txt-secondary">
                <th className="text-left pb-2">Produto</th>
                <th className="text-right pb-2 w-16">Qtd</th>
                <th className="text-right pb-2 w-28">Unit.</th>
                <th className="text-right pb-2 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-2 font-semibold">{it.name}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(it.price)}</td>
                  <td className="py-2 text-right font-bold">{formatCurrency(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className="flex justify-end border-t-2 border-gray-900 pt-4">
          <div className="w-full md:w-80 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-txt-secondary">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Frete</span><span>{formatCurrency(order.shipping_cost)}</span></div>
            <div className="flex justify-between items-baseline pt-2 border-t border-border">
              <span className="font-bold text-lg">Total</span>
              <span className="font-heading font-black text-2xl">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between text-xs text-txt-secondary pt-2">
              <span>Forma de pagamento</span>
              <span className="uppercase font-semibold">{order.payment_method}</span>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center text-[10px] text-txt-secondary mt-10 pt-4 border-t border-border">
          Documento interno de faturamento — emitido eletronicamente. Não substitui nota fiscal.
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white; }
          .invoice-doc { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
