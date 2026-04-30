import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ShieldCheck, Truck, CreditCard, Instagram, Facebook, Youtube, MessageCircle } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import BrandLogo from '../branding/BrandLogo';

export default function StoreFooter() {
  const s = useSiteSettings();
  const storeName = s?.store_name || 'OxxPharma';
  const footerPages = s?.footer_pages || [];

  return (
    <footer className="bg-white border-t border-border mt-16" data-testid="store-footer">
      {/* Trust strip */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <TrustItem icon={Truck} title="Entrega rápida" desc="Receba em todo Brasil" />
          <TrustItem icon={ShieldCheck} title="Compra segura" desc="Dados 100% protegidos" />
          <TrustItem icon={CreditCard} title="Parcele em até 6x" desc="Cartão, PIX ou boleto" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BrandLogo slot="store_footer" variant="light" textClassName="font-heading font-black text-lg" />
          </div>
          <p className="text-xs text-txt-secondary leading-relaxed">
            {s?.footer_about || 'Farmácia digital com entrega rápida e segura em todo o Brasil.'}
          </p>
          {/* Social */}
          <div className="flex gap-2 mt-4">
            {s?.social_instagram && <SocialLink href={s.social_instagram} icon={Instagram} />}
            {s?.social_facebook && <SocialLink href={s.social_facebook} icon={Facebook} />}
            {s?.social_youtube && <SocialLink href={s.social_youtube} icon={Youtube} />}
            {s?.social_whatsapp && <SocialLink href={s.social_whatsapp} icon={MessageCircle} />}
          </div>
        </div>

        <div>
          <h4 className="font-bold text-sm text-txt-primary mb-3">Institucional</h4>
          <ul className="space-y-2 text-xs text-txt-secondary">
            {footerPages.length === 0 ? (
              <li className="italic text-txt-secondary/70">Configure em /backoffice/aparencia</li>
            ) : footerPages.map((p, i) => (
              <li key={i}>
                <Link to={`/p/${p.slug}`} className="hover:text-brand-main transition" data-testid={`footer-page-${p.slug}`}>{p.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm text-txt-primary mb-3">Minha conta</h4>
          <ul className="space-y-2 text-xs text-txt-secondary">
            <li><Link to="/meus-pedidos">Meus pedidos</Link></li>
            <li><Link to="/meus-enderecos">Endereços</Link></li>
            <li><Link to="/indique-ganhe" className="text-brand-main font-semibold">Indique e ganhe</Link></li>
            <li><Link to="/cadastrar">Cadastre-se</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm text-txt-primary mb-3">Contato</h4>
          <ul className="space-y-2 text-xs text-txt-secondary">
            {s?.footer_contact_phone && <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {s.footer_contact_phone}</li>}
            {s?.footer_contact_email && <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {s.footer_contact_email}</li>}
            {s?.footer_address && <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {s.footer_address}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-txt-secondary">
          © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

function TrustItem({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-main" />
      </div>
      <div>
        <div className="text-sm font-bold text-txt-primary">{title}</div>
        <div className="text-xs text-txt-secondary">{desc}</div>
      </div>
    </div>
  );
}

function SocialLink({ href, icon: Icon }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-bg-secondary hover:bg-brand-light flex items-center justify-center text-txt-secondary hover:text-brand-main transition">
      <Icon className="w-4 h-4" />
    </a>
  );
}
