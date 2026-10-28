import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteSettings } from '../../hooks/useSiteSettings';

export default function FloatingWhatsApp() {
  const settings = useSiteSettings();
  const location = useLocation();

  // Verifica se o WhatsApp está configurado e habilitado
  const isEnabled = settings?.whatsapp?.enabled;
  const rawNumber = settings?.whatsapp?.number || settings?.social_whatsapp || '';
  let digits = String(rawNumber).replace(/\D/g, '');

  if (!isEnabled || !digits) {
    return null;
  }

  // Se o número tiver 10 ou 11 dígitos (DDD + número), adiciona o DDI 55 do Brasil
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  // Mensagem inicial de atendimento
  let message = 'Olá! Estou navegando no site da OxxPharma e gostaria de atendimento.';
  if (typeof window !== 'undefined' && location.pathname && location.pathname !== '/') {
    message = `Olá! Estou navegando no site da OxxPharma (${window.location.href}) e gostaria de tirar algumas dúvidas.`;
  }

  const whatsappHref = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex items-center group"
      data-testid="floating-whatsapp-container"
    >
      {/* Tooltip informativo ao passar o mouse */}
      <span
        className="hidden sm:inline-flex items-center gap-2 mr-3 px-3.5 py-1.5 bg-white text-gray-800 text-xs font-bold rounded-full shadow-lg border border-gray-100 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-2 group-hover:translate-x-0 pointer-events-none"
      >
        <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
        Fale conosco no WhatsApp
      </span>

      {/* Botão Flutuante */}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Atendimento via WhatsApp"
        className="relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 focus:outline-hidden"
        data-testid="floating-whatsapp-btn"
      >
        {/* Efeito de pulso suave */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-35 animate-ping -z-10" />

        {/* Ícone oficial do WhatsApp */}
        <svg
          className="w-8 h-8 sm:w-9 sm:h-9 fill-current"
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <path d="M16.01 2.5C8.56 2.5 2.5 8.56 2.5 16.01c0 2.65.77 5.12 2.1 7.21L2.5 29.5l6.46-2.05c2.01 1.22 4.37 1.94 6.9 1.94 7.45 0 13.51-6.06 13.51-13.51S23.46 2.5 16.01 2.5zm7.84 19.06c-.33.93-1.66 1.71-2.39 1.83-.69.11-1.57.16-2.52-.15-.58-.19-1.32-.43-2.28-.85-4.04-1.74-6.66-5.83-6.86-6.1-.2-.27-1.65-2.2-1.65-4.19s1.04-2.97 1.41-3.37c.37-.4.81-.5 1.08-.5h.77c.25 0 .58-.09.91.7.34.8.84 2.06.91 2.21.07.15.12.33.02.53-.1.2-.15.33-.3.51-.15.18-.32.4-.46.54-.15.15-.31.32-.13.63.18.31.8 1.32 1.72 2.14 1.18 1.05 2.18 1.38 2.49 1.53.31.15.49.13.67-.08.18-.21.78-.91 1-1.22.21-.31.43-.26.73-.15.3.11 1.9.9 2.23 1.06.33.17.55.25.63.38.08.14.08.8-.25 1.73z" />
        </svg>
      </a>
    </div>
  );
}
