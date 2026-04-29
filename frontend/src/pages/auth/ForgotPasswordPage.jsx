import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage({ mode = 'reset' }) {
  // mode: 'reset' | 'first_access'
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const path = mode === 'first_access' ? '/api/auth/first-access/request' : '/api/auth/password-reset/request';
      await api.post(path, { email });
      setSent(true);
    } catch (e) {
      toast.error(e?.message || 'Erro');
    } finally { setSubmitting(false); }
  };

  const isFirst = mode === 'first_access';

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl border border-border">
        <Link to="/login" className="inline-flex items-center gap-1 text-xs text-txt-secondary mb-4 hover:text-brand-main">
          <ArrowLeft className="w-3 h-3" /> Voltar ao login
        </Link>
        {sent ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="font-heading font-black text-xl mb-2">Verifique seu e-mail</h1>
            <p className="text-sm text-txt-secondary">
              Se o e-mail estiver cadastrado, enviamos um link para você {isFirst ? 'criar sua senha' : 'redefinir sua senha'}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} data-testid="forgot-password-form">
            <h1 className="font-heading font-black text-2xl mb-1">
              {isFirst ? 'Primeiro acesso' : 'Esqueci minha senha'}
            </h1>
            <p className="text-sm text-txt-secondary mb-6">
              {isFirst ? 'Digite seu e-mail para receber o link de criação de senha.' : 'Enviaremos um link para redefinir sua senha.'}
            </p>
            <label className="text-xs font-semibold block mb-1">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm mb-5 focus:outline-none focus:border-brand-main"
              data-testid="forgot-email" />
            <Button type="submit" disabled={submitting} className="w-full" data-testid="forgot-submit">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Enviar link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
