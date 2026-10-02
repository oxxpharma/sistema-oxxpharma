import React, { useRef } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ShieldCheck, Printer, Copy, FileText, X, Monitor, Globe, Calendar, User, Building, CreditCard, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDateTime } from '../../lib/utils';

export default function PayrollAcceptanceModal({ open, onClose, audit, order }) {
  const printRef = useRef(null);

  if (!open) return null;

  // Fallback se o audit veio solto ou dentro do order
  const a = audit || order?.payroll_acceptance_audit || {};

  const copyHash = () => {
    if (a.digital_signature_hash) {
      navigator.clipboard.writeText(a.digital_signature_hash);
      toast.success('Assinatura SHA-256 copiada!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalVal = a.order_total || order?.total || 0;
  const installments = a.installments || order?.payroll_installments || 1;
  const instVal = a.installment_amount || (totalVal / installments);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-border bg-emerald-950 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-white">
                Certificado de Aceite Digital · Desconto em Folha
              </h2>
              <p className="text-xs text-emerald-300">
                Registro de Conformidade Legal e Irrepudiabilidade
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable & Printable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm" ref={printRef}>
          
          {/* Status Badge & Order Header */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="bg-emerald-600 text-white px-3 py-1 text-xs">
                ✓ Aceite Registrado & Válido
              </Badge>
              <span className="text-xs font-semibold text-emerald-900">
                Pedido #{order?.order_id ? order.order_id.slice(-8).toUpperCase() : (a.order_id ? a.order_id.slice(-8).toUpperCase() : '')}
              </span>
            </div>
            <div className="text-xs text-emerald-800 font-medium">
              Data/Hora: <b>{a.accepted_at_fmt || (a.accepted_at ? formatDateTime(a.accepted_at) : 'N/A')}</b>
            </div>
          </div>

          {/* Criptografia / SHA-256 Hash Card */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-1.5 border border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> Assinatura Digital Criptográfica (SHA-256)
              </span>
              {a.digital_signature_hash && (
                <button
                  onClick={copyHash}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition"
                >
                  <Copy className="w-3 h-3" /> Copiar Hash
                </button>
              )}
            </div>
            <div className="font-mono text-xs break-all bg-slate-950 p-2.5 rounded border border-slate-800 text-emerald-300">
              {a.digital_signature_hash || 'Sem hash gerado'}
            </div>
            <div className="text-[10px] text-slate-400">
              Garantia de Integridade: combina o ID do pedido, CPF do titular, valor total, parcelas, IP, carimbo de tempo e o texto exato assinado.
            </div>
          </div>

          {/* Grid de Evidências */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Funcionário & Empresa */}
            <div className="bg-white border border-border rounded-xl p-4 space-y-2.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-txt-secondary flex items-center gap-1.5 border-b border-border pb-1.5">
                <User className="w-4 h-4 text-brand-main" /> Titular & Conveniada
              </h3>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-txt-secondary">Funcionário:</span>{' '}
                  <b className="text-txt-primary">{a.customer_name || order?.customer_name || 'N/A'}</b>
                </div>
                <div>
                  <span className="text-txt-secondary">CPF:</span>{' '}
                  <b className="font-mono text-txt-primary">{a.customer_cpf || order?.customer_cpf || 'N/A'}</b>
                </div>
                <div>
                  <span className="text-txt-secondary">Matrícula Funcional:</span>{' '}
                  <b className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                    {a.registration_number || a.matricula || 'Não informada'}
                  </b>
                </div>
                <div>
                  <span className="text-txt-secondary">Empresa Credenciada:</span>{' '}
                  <b>{a.company_name || 'N/A'}</b>
                </div>
                {a.company_cnpj && (
                  <div>
                    <span className="text-txt-secondary">CNPJ Empresa:</span>{' '}
                    <span className="font-mono">{a.company_cnpj}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Evidências Técnicas & Dispositivo */}
            <div className="bg-white border border-border rounded-xl p-4 space-y-2.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-txt-secondary flex items-center gap-1.5 border-b border-border pb-1.5">
                <Globe className="w-4 h-4 text-brand-main" /> Evidências Técnicas do Aceite
              </h3>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-txt-secondary">Endereço IP:</span>{' '}
                  <b className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                    {a.ip_address || a.ip || 'Não registrado'}
                  </b>
                </div>
                <div>
                  <span className="text-txt-secondary">Dispositivo:</span>{' '}
                  <b>{a.device_type || 'Navegador Web'}</b>
                </div>
                <div>
                  <span className="text-txt-secondary">Sistema Operacional:</span>{' '}
                  <span>{a.os_info || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-txt-secondary">Navegador:</span>{' '}
                  <span>{a.browser_info || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-txt-secondary">Valor Autorizado:</span>{' '}
                  <b className="text-emerald-700">{formatCurrency(totalVal)}</b> em <b>{installments}x de {formatCurrency(instVal)}</b>
                </div>
              </div>
            </div>

          </div>

          {/* User Agent Completo */}
          {a.user_agent && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
              <span className="text-txt-secondary font-medium block mb-1">User-Agent Completo do Dispositivo:</span>
              <div className="font-mono text-[11px] text-slate-700 break-all bg-white p-2 rounded border border-slate-200">
                {a.user_agent}
              </div>
            </div>
          )}

          {/* Texto Completo do Termo Renderizado no Aceite */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-txt-secondary flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand-main" /> Texto do Termo Apresentado no Momento da Compra
            </h3>
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto text-slate-800 shadow-inner">
              {a.rendered_terms_text || a.terms_text || 'Sem texto de termo armazenado.'}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir / Baixar Certificado
          </Button>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>

      </div>
    </div>
  );
}
