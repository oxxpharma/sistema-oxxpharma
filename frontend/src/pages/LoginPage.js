import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

const BG_URL = 'https://images.unsplash.com/photo-1642055514517-7b52288890ec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxwaGFybWFjeSUyMHBoYXJtYWNldXRpY2FsJTIwcHJvZHVjdHMlMjBzaGVsdmVzfGVufDB8fHx8MTc3NTc1NDE1NHww&ixlib=rb-4.1.0&q=85';
const LOGO_URL = 'https://static.prod-images.emergentagent.com/jobs/ac7e11bd-2d3b-4351-a0cb-75f5d21dc8a6/images/11999c45dfa606ad3f30f54326fa63e71a49f9d047fe241b470a9da4e5771ede.png';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-body">
      {/* Left - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={BG_URL} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-brand-main/80" />
        <div className="relative z-10 flex flex-col justify-end p-16">
          <h2 className="font-heading font-black text-4xl text-white tracking-tight leading-tight">
            Sistema de<br />Franquias<br />OxxPharma
          </h2>
          <p className="text-white/70 mt-4 text-lg max-w-md">
            Gerencie sua rede de franquias farmaceuticas com controle total de comissoes, produtos e equipe.
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <img src={LOGO_URL} alt="OxxPharma" className="h-10" />
            <span className="font-heading font-bold text-2xl text-txt-primary tracking-tight">OxxPharma</span>
          </div>

          <h1 className="font-heading font-bold text-2xl text-txt-primary tracking-tight">Entrar</h1>
          <p className="text-sm text-txt-secondary mt-1">Acesse sua conta para continuar</p>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-accent-red" data-testid="login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-main focus:border-brand-main transition-all"
                placeholder="seu@email.com"
                required
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-txt-secondary uppercase tracking-wide mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-md text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-brand-main focus:border-brand-main transition-all"
                  placeholder="Sua senha"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary hover:text-txt-primary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-main text-white font-semibold text-sm rounded-md hover:bg-brand-hover disabled:opacity-50 transition-all"
              data-testid="login-submit-btn"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-txt-secondary">
            Nao tem conta?{' '}
            <Link to="/register" className="text-brand-main font-semibold hover:underline">Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
