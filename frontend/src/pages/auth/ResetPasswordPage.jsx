import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPasswordPage({ mode = 'reset' }) {
  // mode: 'reset' (60min) | 'first_access' (7d)
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [info, setInfo] = useState(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    (async () => {
      try {
        const r = await api.get(`/api/auth/password-reset/validate?token=${token}`);
        setValid(true); setInfo(r);
      } catch (e) {
        toast.error(e?.message || 'Link invalido');
      } finally { setValidating(false); }
    })();
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }
    if (pw !== pw2) { toast.error('Senhas não conferem'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/auth/password-reset/confirm', { token, password: pw });
      setDone(true);
      toast.success('Senha definida! Faça login.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (e) {
      toast.error(e?.message || 'Erro ao definir senha');
    } finally { setSubmitting(false); }
  };

  const isFirst = (info?.type || mode) === 'first_access';

  if (validating) return <Center><Loader2 className="w-10 h-10 animate-spin text-brand-main" /></Center>;
  if (!valid) return (
    <Center>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
          <KeyRound className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="font-heading font-black text-2xl mb-2">Link inválido</h1>
        <p className="text-sm text-txt-secondary mb-6">Este link expirou ou já foi utilizado.</p>
        <Link to="/login"><Button>Voltar ao login</Button></Link>
      </div>
    </Center>
  );
  if (done) return (
    <Center>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="font-heading font-black text-2xl">Senha definida!</h1>
        <p className="text-sm text-txt-secondary mt-2">Redirecionando para o login...</p>
      </div>
    </Center>
  );

  return (
    <Center>
      <form onSubmit={submit} className="w-full max-w-sm bg-white p-8 rounded-2xl border border-border" data-testid="reset-password-form">
        <h1 className="font-heading font-black text-2xl mb-1">
          {isFirst ? 'Defina sua senha' : 'Recupere sua senha'}
        </h1>
        <p className="text-sm text-txt-secondary mb-6">
          {isFirst ? `Bem-vindo, ${info?.name || ''}! Esta é sua primeira senha.` : `Para ${info?.email || ''}`}
        </p>
        <label className="text-xs font-semibold block mb-1">Nova senha</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} required minLength={6}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm mb-3 focus:outline-none focus:border-brand-main"
          data-testid="reset-password-1" />
        <label className="text-xs font-semibold block mb-1">Confirmar senha</label>
        <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} required minLength={6}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm mb-5 focus:outline-none focus:border-brand-main"
          data-testid="reset-password-2" />
        <Button type="submit" disabled={submitting} className="w-full" data-testid="reset-password-submit">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {isFirst ? 'Criar senha' : 'Definir nova senha'}
        </Button>
      </form>
    </Center>
  );
}

function Center({ children }) {
  return <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">{children}</div>;
}
