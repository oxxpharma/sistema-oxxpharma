import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { Copy, Link2, Share2 } from 'lucide-react';

export default function ReferralPage() {
  const { user } = useAuth();
  const link = `${window.location.origin}/store?ref=${user?.referral_code}`;

  const copy = (text) => navigator.clipboard.writeText(text);

  return (
    <AppLayout title="Link de Indicacao" subtitle="Compartilhe e ganhe comissoes">
      <div className="max-w-lg space-y-6 fade-in">
        <DashCard title="Seu Codigo">
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-bg-secondary rounded-md border border-border">
              <code className="text-lg font-mono font-bold text-brand-main" data-testid="referral-code">{user?.referral_code}</code>
            </div>
            <button onClick={() => copy(user?.referral_code)} className="p-3 bg-brand-main text-white rounded-md hover:bg-brand-hover" data-testid="copy-code-btn">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </DashCard>

        <DashCard title="Seu Link de Indicacao">
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-bg-secondary rounded-md border border-border overflow-hidden">
              <code className="text-xs font-mono text-txt-secondary break-all" data-testid="referral-link">{link}</code>
            </div>
            <button onClick={() => copy(link)} className="p-3 bg-brand-main text-white rounded-md hover:bg-brand-hover" data-testid="copy-link-btn">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </DashCard>

        <DashCard title="Como funciona">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-brand-light flex items-center justify-center text-brand-main font-bold text-sm flex-shrink-0">1</div>
              <div>
                <p className="text-sm font-medium text-txt-primary">Compartilhe seu link</p>
                <p className="text-xs text-txt-secondary mt-0.5">Envie para pessoas interessadas nos produtos OxxPharma</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-brand-light flex items-center justify-center text-brand-main font-bold text-sm flex-shrink-0">2</div>
              <div>
                <p className="text-sm font-medium text-txt-primary">Eles compram pela sua indicacao</p>
                <p className="text-xs text-txt-secondary mt-0.5">Quando alguem compra usando seu link, voce ganha comissao</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-brand-light flex items-center justify-center text-brand-main font-bold text-sm flex-shrink-0">3</div>
              <div>
                <p className="text-sm font-medium text-txt-primary">Receba suas comissoes</p>
                <p className="text-xs text-txt-secondary mt-0.5">Comissoes sao creditadas ate a 6a geracao da sua rede</p>
              </div>
            </div>
          </div>
        </DashCard>
      </div>
    </AppLayout>
  );
}
