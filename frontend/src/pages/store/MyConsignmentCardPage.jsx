import React from 'react';
import MyConsignmentCard from '../../components/convenio/MyConsignmentCard';
import { CreditCard } from 'lucide-react';

export default function MyConsignmentCardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" data-testid="my-consignment-card-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-brand-main" /> Meu Cartão Consignado
          </h1>
          <p className="text-sm text-txt-secondary">
            Consulte seus limites de desconto em folha, margem disponível e extrato de parcelamento.
          </p>
        </div>
      </div>

      <MyConsignmentCard />
    </div>
  );
}
