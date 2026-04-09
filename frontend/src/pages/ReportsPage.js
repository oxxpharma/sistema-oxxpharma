import React from 'react';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <AppLayout title="Relatorios" subtitle="Analise de dados do sistema">
      <div className="fade-in">
        <DashCard>
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 mx-auto text-border mb-3" />
            <p className="text-txt-secondary font-medium">Relatorios em desenvolvimento</p>
            <p className="text-xs text-txt-secondary mt-1">Os relatorios detalhados estarao disponiveis em breve</p>
          </div>
        </DashCard>
      </div>
    </AppLayout>
  );
}
