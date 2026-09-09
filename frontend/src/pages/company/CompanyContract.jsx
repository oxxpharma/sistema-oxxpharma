import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyContract() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setCompany(await api.get('/api/company/me')); }
      catch (err) { toast.error(err.message); }
      finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="company-contract">
      <h1 className="font-heading font-black text-3xl mb-4">Contrato</h1>
      <div className="bg-white border border-border rounded-xl p-6">
        {company?.contract_url ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-brand-main/10 text-brand-main flex items-center justify-center"><FileText className="w-6 h-6" /></div>
              <div>
                <div className="font-heading font-black">Contrato de Convênio · {company.name}</div>
                <div className="text-xs text-txt-secondary">Documento oficial disponível para consulta</div>
              </div>
            </div>
            <a href={company.contract_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-main text-white rounded-lg font-semibold hover:opacity-90">
              Abrir contrato <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="text-center py-10 text-txt-secondary">
            <FileText className="w-12 h-12 mx-auto opacity-40 mb-2" />
            <div>Nenhum contrato disponível no momento.</div>
            <div className="text-xs mt-1">Entre em contato com a OxxPharma pelo email <b>convenio@oxxpharma.com</b>.</div>
          </div>
        )}
      </div>
    </div>
  );
}
