import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCog, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Banner fixo no topo da tela quando o admin está "entrando como" outro usuário.
 * Aparece em TODAS as páginas (loja e backoffice) para o admin saber o tempo inteiro.
 */
export default function ImpersonationBanner() {
  const { impersonating, impersonator, user, stopImpersonation } = useAuth();
  if (!impersonating || !impersonator) return null;

  const onStop = async () => {
    try {
      await stopImpersonation();
      toast.success('Sessão encerrada. Você voltou a ser ' + (impersonator.email || 'admin'));
      // Redireciona para o backoffice
      setTimeout(() => { window.location.href = '/backoffice/usuarios'; }, 400);
    } catch (e) {
      toast.error('Falha ao encerrar: ' + (e?.message || e));
    }
  };

  return (
    <div
      className="sticky top-0 z-[100] bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow"
      data-testid="impersonation-banner"
    >
      <div className="flex items-center gap-2 text-sm min-w-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="font-bold flex-shrink-0">Modo assumir conta:</span>
        <span className="truncate">
          você está logado como <strong>{user?.name || user?.email}</strong> ·
          por <span className="font-mono text-xs">{impersonator.email}</span>
        </span>
      </div>
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded transition flex-shrink-0"
        data-testid="impersonation-stop-btn"
      >
        <LogOut className="w-3.5 h-3.5" />
        Voltar à minha conta
      </button>
    </div>
  );
}
