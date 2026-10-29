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
        <svg id="Camada_2" data-name="Camada 2" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 286.27 286.27">
  <defs>
    <style>
      .cls-1 {
        fill: #fff;
      }

      .cls-1, .cls-2 {
        fill-rule: evenodd;
      }

      .cls-2 {
        fill: url(#Degradado_sin_nombre_13);
      }
    </style>
    <linearGradient id="Degradado_sin_nombre_13" data-name="Degradado sin nombre 13" x1="146.46" y1="17.44" x2="146.46" y2="263.55" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4ac14b"/>
      <stop offset="1" stop-color="#06853a"/>
    </linearGradient>
  </defs>
  <g id="OBJECTS">
    <g>
      <path class="cls-2" d="M146.46,17.44c-68.4,0-124.02,55.2-124.02,123.06,0,26.91,8.77,51.86,23.62,72.15l-15.49,45.69,47.65-15.14c19.58,12.85,43.03,20.34,68.24,20.34,68.37,0,124.01-55.2,124.01-123.05S214.83,17.44,146.46,17.44h0Z"/>
      <path class="cls-1" d="M286.27,139.45c0,77-62.92,139.44-140.53,139.44-24.65,0-47.8-6.29-67.93-17.35L0,286.27l25.36-74.81c-12.8-21.02-20.16-45.66-20.16-72C5.2,62.43,68.12,0,145.74,0s140.53,62.43,140.53,139.45h0ZM145.74,22.21c-65.17,0-118.16,52.59-118.16,117.24,0,25.64,8.35,49.4,22.5,68.74l-14.75,43.53,45.4-14.42c18.65,12.24,41,19.38,65.01,19.38,65.14,0,118.15-52.59,118.15-117.23S210.88,22.21,145.74,22.21h0ZM216.7,171.57c-.87-1.43-3.17-2.28-6.6-3.99-3.45-1.71-20.39-9.98-23.55-11.12-3.15-1.14-5.47-1.71-7.75,1.71-2.3,3.42-8.9,11.12-10.92,13.4-2,2.29-4.01,2.56-7.45.85-3.45-1.71-14.56-5.33-27.71-16.96-10.23-9.07-17.15-20.25-19.17-23.67-2-3.42-.2-5.26,1.51-6.97,1.55-1.54,3.45-3.99,5.17-5.98,1.73-2,2.3-3.44,3.45-5.72,1.15-2.28.58-4.27-.29-5.98-.85-1.71-7.75-18.53-10.62-25.38-2.85-6.83-5.73-6.58-7.75-6.58s-5.72.6-5.72.6c0,0-6.91.85-10.06,4.27-3.15,3.42-12.05,11.69-12.05,28.5s12.33,33.08,14.06,35.35c1.73,2.29,23.82,37.93,58.85,51.61,35.02,13.68,35.02,9.12,41.34,8.54,6.31-.56,20.38-8.26,23.25-16.25,2.87-7.98,2.87-14.83,2.02-16.25h0Z"/>
    </g>
  </g>
</svg>
      </a>
    </div>
  );
}
