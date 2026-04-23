import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ShieldCheck, Truck, CreditCard } from 'lucide-react';

export default function StoreFooter() {
  return (
    <footer className="bg-white border-t border-border mt-16" data-testid="store-footer">
      {/* Trust strip */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">
              <Truck className="w-5 h-5 text-brand-main" />
            </div>
            <div>
              <div className="text-sm font-bold text-txt-primary">Entrega rápida</div>
              <div className="text-xs text-txt-secondary">Receba em todo Brasil</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-brand-main" />
            </div>
            <div>
              <div className="text-sm font-bold text-txt-primary">Compra segura</div>
              <div className="text-xs text-txt-secondary">Dados 100% protegidos</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-brand-main" />
            </div>
            <div>
              <div className="text-sm font-bold text-txt-primary">Parcele em até 6x</div>
              <div className="text-xs text-txt-secondary">Cartão, PIX ou boleto</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-main flex items-center justify-center">
              <span className="text-white font-heading font-black">O</span>
            </div>
            <span className="font-heading font-black text-lg">OxxPharma</span>
          </div>
          <p className="text-xs text-txt-secondary leading-relaxed">
            Farmácia digital com entrega rápida e segura em todo o Brasil. Produtos selecionados pelos melhores profissionais da saúde.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-sm text-txt-primary mb-3">Institucional</h4>
          <ul className="space-y-2 text-xs text-txt-secondary">
            <li><Link to="/">Sobre nós</Link></li>
            <li><Link to="/">Política de Privacidade</Link></li>
            <li><Link to="/">Termos de Uso</Link></li>
            <li><Link to="/">Trocas e Devoluções</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm text-txt-primary mb-3">Minha conta</h4>
          <ul className="space-y-2 text-xs text-txt-secondary">
            <li><Link to="/meus-pedidos">Meus pedidos</Link></li>
            <li><Link to="/meus-enderecos">Endereços</Link></li>
            <li><Link to="/indique-ganhe" className="text-brand-main font-semibold">Indique e ganhe 8%</Link></li>
            <li><Link to="/cadastrar">Cadastre-se</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-sm text-txt-primary mb-3">Contato</h4>
          <ul className="space-y-2 text-xs text-txt-secondary">
            <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> 0800 123 4567</li>
            <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> contato@oxxpharma.com</li>
            <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> São Paulo - SP</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-txt-secondary">
          © {new Date().getFullYear()} OxxPharma. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
