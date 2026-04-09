import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Globe2, MapPin, Building2, Store, Users, DollarSign, Shield } from 'lucide-react';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_oxx-franchise-system/artifacts/5hmh2yiu_image.png';
const BG_URL = 'https://images.unsplash.com/photo-1642055514517-7b52288890ec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxwaGFybWFjeSUyMHBoYXJtYWNldXRpY2FsJTIwcHJvZHVjdHMlMjBzaGVsdmVzfGVufDB8fHx8MTc3NTc1NDE1NHww&ixlib=rb-4.1.0&q=85';

const levels = [
  { icon: Globe2, name: 'Nacional', desc: 'Controle centralizado e investimentos da empresa', color: 'bg-orange-100 text-orange-700' },
  { icon: MapPin, name: 'Estadual', desc: 'Profissionais da saude e farmacias que gerenciam estados', color: 'bg-emerald-100 text-emerald-700' },
  { icon: Building2, name: 'Regional', desc: 'Gestao de unidades por DDD e regiao', color: 'bg-violet-100 text-violet-700' },
  { icon: Store, name: 'Cidade', desc: 'Unidades com lojas fisicas que vendem produtos', color: 'bg-amber-100 text-amber-700' },
];

const features = [
  { icon: Users, title: 'Rede Multinivel', desc: 'Comissoes ate a 6a geracao com porcentagens configuraveis' },
  { icon: DollarSign, title: 'Franquias', desc: 'Sistema de franquias por nivel com base no faturamento anual' },
  { icon: Shield, title: 'Controle Total', desc: 'Dashboard completo com gestao de produtos, pedidos e comissoes' },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="OxxPharma" className="h-8" />
            <span className="font-heading font-bold text-lg text-txt-primary tracking-tight">OxxPharma</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard" className="px-4 py-2 bg-brand-main text-white text-sm font-semibold rounded-md hover:bg-brand-hover transition-all" data-testid="landing-dashboard-btn">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-txt-secondary hover:text-txt-primary transition-all" data-testid="landing-login-btn">
                  Entrar
                </Link>
                <Link to="/register" className="px-4 py-2 bg-brand-main text-white text-sm font-semibold rounded-md hover:bg-brand-hover transition-all" data-testid="landing-register-btn">
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-light rounded-md text-xs font-semibold text-brand-main mb-6">
              Sistema de Franquias Farmaceuticas
            </div>
            <h1 className="font-heading font-black text-4xl lg:text-5xl text-txt-primary tracking-tight leading-tight">
              Gerencie sua rede de franquias com controle total
            </h1>
            <p className="text-lg text-txt-secondary mt-4 leading-relaxed max-w-md">
              OxxPharma e a plataforma completa para gestao de franquias farmaceuticas com marketing multinivel ate a 6a geracao.
            </p>
            <div className="flex gap-3 mt-8">
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-main text-white font-semibold rounded-md hover:bg-brand-hover transition-all" data-testid="hero-cta-btn">
                Comecar Agora <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login" className="px-6 py-3 border border-border text-txt-primary font-semibold rounded-md hover:bg-bg-secondary transition-all">
                Ja tenho conta
              </Link>
            </div>
          </div>
          <div className="hidden lg:block">
            <img src={BG_URL} alt="OxxPharma" className="rounded-md border border-border" />
          </div>
        </div>
      </section>

      {/* Levels */}
      <section className="py-20 px-6 bg-bg-secondary">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading font-bold text-2xl text-txt-primary tracking-tight text-center">Estrutura de Niveis</h2>
          <p className="text-txt-secondary text-center mt-2 max-w-md mx-auto">Cada nivel funciona como uma franquia com gestao independente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {levels.map((lvl, idx) => (
              <div key={idx} className="bg-white border border-border rounded-md p-5 hover:-translate-y-1 transition-all">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${lvl.color} mb-4`}>
                  <lvl.icon className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-semibold text-txt-primary">{lvl.name}</h3>
                <p className="text-sm text-txt-secondary mt-1">{lvl.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading font-bold text-2xl text-txt-primary tracking-tight text-center">Recursos do Sistema</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10">
            {features.map((f, idx) => (
              <div key={idx} className="text-center p-6">
                <div className="w-12 h-12 rounded-md bg-brand-light flex items-center justify-center mx-auto mb-4">
                  <f.icon className="w-6 h-6 text-brand-main" />
                </div>
                <h3 className="font-heading font-semibold text-txt-primary">{f.title}</h3>
                <p className="text-sm text-txt-secondary mt-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="OxxPharma" className="h-6" />
            <span className="font-heading font-bold text-sm text-txt-secondary">OxxPharma</span>
          </div>
          <p className="text-xs text-txt-secondary">2026 OxxPharma. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
