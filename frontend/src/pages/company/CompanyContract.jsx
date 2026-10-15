import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import {
  Loader2,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  ShieldCheck,
  Building2,
  PenTool,
  AlertCircle,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyContract() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadContract = useCallback(async (showToast = false) => {
    try {
      const data = await api.get('/api/company/contract');
      setContract(data);
      if (showToast) {
        toast.success('Status do contrato atualizado com sucesso!');
      }
      return data;
    } catch (err) {
      if (showToast) {
        toast.error(err.message || 'Erro ao carregar dados do contrato');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleSyncD4Sign = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/api/company/contract/sync-d4sign');
      await loadContract(false);
      if (res?.is_signed) {
        toast.success('Parabéns! O contrato foi assinado com sucesso!');
      } else {
        toast.info(res?.d4sign_status_name || 'Contrato ainda aguarda assinatura no D4Sign.');
      }
    } catch (err) {
      toast.error(err.message || 'Falha ao sincronizar com o D4Sign.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDownload = async (isSigned = false) => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const cid = contract?.company_id || 'empresa';
      const filename = isSigned
        ? `Contrato_Convenio_${cid}_Assinado.pdf`
        : `Contrato_Convenio_${cid}_Minuta.pdf`;
      const url = isSigned && contract?.contract_signed_url
        ? contract.contract_signed_url
        : (contract?.contract_url || `/api/company-contracts/${cid}.pdf`);

      const sep = url.includes('?') ? '&' : '?';
      const fullUrl = `${url}${token ? `${sep}auth=${token}` : ''}`;

      const res = await fetch(fullUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Falha ao baixar o arquivo do contrato.');
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Download do contrato concluído!');
    } catch (err) {
      toast.error(err.message || 'Erro ao efetuar o download do contrato.');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenPdf = (isSigned = false) => {
    const token = localStorage.getItem('token');
    const cid = contract?.company_id || 'empresa';
    const url = isSigned && contract?.contract_signed_url
      ? contract.contract_signed_url
      : (contract?.contract_url || `/api/company-contracts/${cid}.pdf`);
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${token ? `${sep}auth=${token}` : ''}`;
    window.open(fullUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="p-16 text-center" data-testid="company-contract-loading">
        <Loader2 className="w-10 h-10 animate-spin inline text-brand-main mb-3" />
        <p className="text-sm text-txt-secondary">Carregando dados do contrato de convênio...</p>
      </div>
    );
  }

  const isSigned = contract?.is_signed || contract?.d4sign_status === 'signed';

  return (
    <div data-testid="company-contract" className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-txt-primary flex items-center gap-3">
            <FileText className="w-7 h-7 text-brand-main" /> Contrato de Convênio
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Instrumento Particular de Convênio Comercial, Benefícios Corporativos e Autorização de Desconto em Folha
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSyncD4Sign()}
          disabled={syncing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-white text-txt-primary hover:bg-slate-50 transition shadow-sm disabled:opacity-60"
          title="Verificar status no D4Sign"
        >
          <RefreshCw className={`w-4 h-4 text-brand-main ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Verificando...' : 'Atualizar Status'}
        </button>
      </div>

      {/* Main Status Box */}
      {isSigned ? (
        /* CONTRATO ASSINADO COM SUCESSO */
        <div
          data-testid="contract-signed-card"
          className="bg-white border-2 border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl -z-0 opacity-70 pointer-events-none" />

          <div className="relative z-10">
            {/* Header com Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Assinado &amp; Válido
                  </div>
                  <h2 className="font-heading font-black text-2xl text-emerald-950">
                    Contrato assinado com sucesso
                  </h2>
                  <p className="text-sm text-txt-secondary mt-1">
                    O termo de convênio e autorização de desconto em folha foi devidamente assinado eletronicamente e possui validade jurídica plena.
                  </p>
                </div>
              </div>
            </div>

            {/* Dados do Contrato e Assinatura */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6 text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-semibold uppercase text-txt-secondary block mb-1">
                  Empresa Conveniada
                </span>
                <span className="font-bold text-txt-primary block text-base truncate">
                  {contract?.company_name || 'Empresa Conveniada'}
                </span>
                <span className="text-xs text-txt-secondary block mt-0.5">
                  CNPJ: {contract?.cnpj || '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-semibold uppercase text-txt-secondary block mb-1">
                  Representante Signatário
                </span>
                <span className="font-bold text-txt-primary block text-base truncate">
                  {contract?.rep_name || 'Responsável Legal'}
                </span>
                <span className="text-xs text-txt-secondary block mt-0.5 truncate">
                  {contract?.rep_email || '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-semibold uppercase text-txt-secondary block mb-1">
                  Certificação Digital D4Sign
                </span>
                <span className="font-bold text-emerald-700 block text-base flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Assinatura Eletrônica
                </span>
                <span className="text-xs text-txt-secondary block mt-0.5 font-mono truncate" title={contract?.d4sign_doc_uuid}>
                  UUID: {contract?.d4sign_doc_uuid ? contract.d4sign_doc_uuid.substring(0, 18) + '...' : 'Concluído'}
                </span>
              </div>
            </div>

            {contract?.d4sign_signed_at && (
              <div className="mb-6 text-xs text-txt-secondary flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Data e hora do registro de assinatura:{' '}
                <span className="font-semibold text-txt-primary">
                  {new Date(contract.d4sign_signed_at).toLocaleString('pt-BR')}
                </span>
              </div>
            )}

            {/* Ações de Download */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/60">
              <button
                type="button"
                onClick={() => handleDownload(true)}
                disabled={downloading}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition transform active:scale-95 disabled:opacity-60 text-sm"
              >
                {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                Baixar cópia do contrato assinado (PDF)
              </button>

              <button
                type="button"
                onClick={() => handleOpenPdf(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-border bg-white text-txt-primary hover:bg-slate-50 rounded-xl font-semibold shadow-sm transition text-sm"
              >
                <Eye className="w-4 h-4 text-txt-secondary" />
                Visualizar no navegador
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CONTRATO DISPONÍVEL PARA ASSINATURA */
        <div
          data-testid="contract-pending-card"
          className="bg-white border-2 border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-50 rounded-full blur-3xl -z-0 opacity-70 pointer-events-none" />

          <div className="relative z-10">
            {/* Header com Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
                  <PenTool className="w-7 h-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 mb-2">
                    <Clock className="w-3.5 h-3.5" /> Aguardando Assinatura
                  </div>
                  <h2 className="font-heading font-black text-2xl text-slate-900">
                    Contrato disponível para assinatura
                  </h2>
                  <p className="text-sm text-txt-secondary mt-1">
                    O contrato de convênio corporativo foi gerado automaticamente e enviado para assinatura eletrônica através da plataforma <b>D4Sign</b>.
                  </p>
                </div>
              </div>
            </div>

            {/* Dados do Contrato */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6 text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-semibold uppercase text-txt-secondary block mb-1">
                  Empresa Conveniada
                </span>
                <span className="font-bold text-txt-primary block text-base truncate">
                  {contract?.company_name || 'Empresa Conveniada'}
                </span>
                <span className="text-xs text-txt-secondary block mt-0.5">
                  CNPJ: {contract?.cnpj || '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-semibold uppercase text-txt-secondary block mb-1">
                  Representante Legal
                </span>
                <span className="font-bold text-txt-primary block text-base truncate">
                  {contract?.rep_name || 'Responsável'}
                </span>
                <span className="text-xs text-txt-secondary block mt-0.5 truncate">
                  {contract?.rep_email || '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-semibold uppercase text-txt-secondary block mb-1">
                  Status D4Sign
                </span>
                <span className="font-bold text-amber-700 block text-base">
                  {contract?.d4sign_status_name || 'Aguardando Assinatura'}
                </span>
                <span className="text-xs text-txt-secondary block mt-0.5 truncate font-mono">
                  {contract?.d4sign_doc_uuid ? `ID: ${contract.d4sign_doc_uuid.substring(0, 16)}...` : 'Pronto para assinatura'}
                </span>
              </div>
            </div>

            {/* Alerta explicativo */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/60 mb-6 text-xs text-blue-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-950 mb-1">Como funciona a assinatura?</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Clique no botão <b>"Assinar Contrato no D4Sign"</b> para abrir a página de assinatura segura.</li>
                  <li>No D4Sign, confirme os dados da sua empresa e valide sua assinatura digital (via token por e-mail ou WhatsApp).</li>
                  <li>Após assinar no D4Sign, retorne a esta página e clique em <b>"Verificar se já assinei"</b> para sincronizar e baixar a via assinada.</li>
                </ol>
              </div>
            </div>

            {/* Ações principais */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/60">
              {contract?.d4sign_sign_url ? (
                <a
                  href={contract.d4sign_sign_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-main hover:bg-brand-main/90 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition transform active:scale-95 text-sm"
                >
                  <PenTool className="w-4 h-4" />
                  Assinar Contrato no D4Sign
                  <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                </a>
              ) : (
                <a
                  href="https://secure.d4sign.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-main hover:bg-brand-main/90 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition transform active:scale-95 text-sm"
                >
                  <PenTool className="w-4 h-4" />
                  Acessar D4Sign para Assinar
                  <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                </a>
              )}

              <button
                type="button"
                onClick={handleSyncD4Sign}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-border bg-white text-txt-primary hover:bg-slate-50 rounded-xl font-semibold shadow-sm transition text-sm disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 text-brand-main ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Verificando no D4Sign...' : 'Verificar se já assinei'}
              </button>

              <button
                type="button"
                onClick={() => handleDownload(false)}
                disabled={downloading}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 text-txt-secondary hover:text-txt-primary hover:bg-slate-100 rounded-xl font-medium transition text-sm ml-auto"
                title="Baixar minuta em PDF para leitura prévia"
              >
                <Download className="w-4 h-4" />
                Baixar minuta preliminar (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Informações legais e de suporte */}
      <div className="bg-slate-50 border border-border/60 rounded-xl p-5 text-xs text-txt-secondary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-slate-400 shrink-0" />
          <div>
            <span className="font-semibold text-txt-primary block">
              Oxx Pharma Magistral Ltda · CNPJ 03.446.178/0001-59
            </span>
            <span>
              Dúvidas contratuais? Fale com nosso time de convênios pelo e-mail{' '}
              <a href="mailto:convenio@oxxpharma.com" className="text-brand-main font-semibold hover:underline">
                convenio@oxxpharma.com
              </a>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Assinatura Digital Certificada ICP-Brasil / D4Sign</span>
        </div>
      </div>
    </div>
  );
}
