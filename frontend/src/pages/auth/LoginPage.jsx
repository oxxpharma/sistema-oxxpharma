import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import BrandLogo from '../../components/branding/BrandLogo';

export default function LoginPage() {
  const { login, verify2FA, resend2FA } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  // 2FA state
  const [twofa, setTwofa] = useState(null); // {pending_token, email_masked, role, email}
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (twofa && inputRef.current) inputRef.current.focus();
  }, [twofa]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const doRedirect = (u) => {
    let dest = redirect;
    if (redirect === '/') {
      if (u.role === 'company_admin') dest = '/empresa';
      else if (u.role === 'propagandista') dest = '/propagandista';
      else if (u.role === 'admin' || u.role === 'super_admin' || u.access_level <= 1) dest = '/backoffice';
    }
    navigate(dest);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result?.requires_2fa) {
        setTwofa({ ...result, email: form.email });
        setCooldown(30);
        toast.info(`Enviamos um código para ${result.email_masked}`);
      } else {
        toast.success(`Olá, ${result.name.split(' ')[0]}!`);
        doRedirect(result);
      }
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    if (code.replace(/\D/g, '').length !== 6) { toast.error('O código tem 6 dígitos'); return; }
    setLoading(true);
    try {
      const u = await verify2FA({ email: twofa.email, code: code.replace(/\D/g, ''), pending_token: twofa.pending_token });
      toast.success(`Olá, ${u.name.split(' ')[0]}! Dispositivo confiável por 7 dias.`);
      doRedirect(u);
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setLoading(true);
    try {
      const r = await resend2FA({ email: twofa.email, pending_token: twofa.pending_token });
      setTwofa(t => ({ ...t, pending_token: r.pending_token, email_masked: r.email_masked }));
      setCooldown(30);
      toast.success('Novo código enviado');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4" data-testid="login-page">
      <div className="max-w-md w-full">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-txt-secondary hover:text-brand-main mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </Link>
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BrandLogo slot="auth_pages" variant="light" textClassName="font-heading font-black text-xl" />
          </div>

          {!twofa && (
            <>
              <h1 className="font-heading font-black text-2xl mb-1">Entrar</h1>
              <p className="text-sm text-txt-secondary mb-6">Acesse sua conta</p>
              <form onSubmit={submit} className="space-y-4">
                <Input label="Email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="login-email" />
                <Input label="Senha" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="login-password" />
                <Button type="submit" loading={loading} className="w-full" size="lg" data-testid="login-submit">Entrar</Button>
              </form>
              <div className="flex justify-between text-xs mt-3">
                <Link to="/esqueci-senha" className="text-brand-main font-semibold hover:underline" data-testid="forgot-password-link">Esqueci minha senha</Link>
                <Link to="/primeiro-acesso-solicitar" className="text-txt-secondary hover:underline" data-testid="first-access-link">Primeiro acesso</Link>
              </div>
              <p className="text-sm text-center text-txt-secondary mt-6">
                Não tem conta? <Link to="/cadastrar" className="text-brand-main font-semibold">Cadastre-se</Link>
              </p>
            </>
          )}

          {twofa && (
            <div data-testid="twofa-screen">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <h1 className="font-heading font-black text-2xl">Verificação em duas etapas</h1>
              </div>
              <p className="text-sm text-txt-secondary mb-4">
                Como <b>{twofa.role === 'company_admin' ? 'RH da empresa' : 'Propagandista'}</b>, você tem acesso a dados sensíveis. Enviamos um código de 6 dígitos para <b>{twofa.email_masked}</b>.
              </p>
              <form onSubmit={submitCode} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-txt-secondary block mb-1">Código (6 dígitos)</label>
                  <input ref={inputRef} type="text" inputMode="numeric" maxLength={7} pattern="[0-9\s]*" autoComplete="one-time-code"
                    value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 border-2 border-border rounded-lg text-center text-2xl font-heading font-black tracking-[0.5em]"
                    placeholder="000000" data-testid="twofa-code-input" />
                </div>
                <Button type="submit" loading={loading} className="w-full" size="lg" data-testid="twofa-submit">Verificar e entrar</Button>
              </form>
              <div className="flex justify-between text-xs mt-3">
                <button type="button" onClick={resend} disabled={cooldown > 0 || loading} className="text-brand-main font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed" data-testid="twofa-resend">
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Não recebi — reenviar'}
                </button>
                <button type="button" onClick={() => { setTwofa(null); setCode(''); }} className="text-txt-secondary hover:underline">Voltar</button>
              </div>
              <p className="text-xs text-txt-secondary mt-6 text-center">
                Este dispositivo ficará marcado como confiável por <b>7 dias</b> após a verificação.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
