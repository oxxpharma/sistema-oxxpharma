import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ShieldCheck, CheckCircle2, Lock, FileText, ArrowRight, Loader2, AlertCircle, RefreshCw, Mail, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function CompleteEmployeeRegistration() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { loginWithToken } = useAuth() || {};

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [step, setStep] = useState(1); // 1: Form, 2: Terms, 3: Verification Code

  // Step 1 Form state
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fetchingCep, setFetchingCep] = useState(false);

  // Step 2 Terms scroll & metadata state
  const scrollRef = useRef(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submittingTerms, setSubmittingTerms] = useState(false);
  const [renderedTermsText, setRenderedTermsText] = useState('');

  // Step 3 Code verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg('Link de convite inválido ou ausente.');
      setLoading(false);
      return;
    }

    const loadInvite = async () => {
      try {
        const info = await api.get(`/api/convenio/invite-info?token=${encodeURIComponent(token)}`);
        setInviteInfo(info);
        if (info.completed) {
          toast.info('Seu cadastro já foi concluído anteriormente. Redirecionando para o login...');
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Falha ao carregar dados do convite');
      } finally {
        setLoading(false);
      }
    };
    loadInvite();
  }, [token, navigate]);

  // Formatações auxiliares
  const formatCpf = (raw) => {
    const d = (raw || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };

  const formatPhone = (raw) => {
    const d = (raw || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const formatZip = (raw) => {
    const d = (raw || '').replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const handleCepBlur = async () => {
    const digits = zipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
      }
    } catch {
      /* silencioso */
    } finally {
      setFetchingCep(false);
    }
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      toast.error('Informe um CPF válido com 11 dígitos.');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Informe um telefone/celular válido.');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    // Prepara o texto do termo pré-visualizável para o Passo 2
    const defaultTerms =
      `ANEXO I - TERMO DE ADESÃO E AUTORIZAÇÃO DE DESCONTO\n\n` +
      `Pelo presente instrumento, eu, ${inviteInfo?.name || 'CONVENIADO'}, inscrito(a) no CPF sob nº ${formatCpf(cpf)}, matrícula funcional nº ${inviteInfo?.registration_number || 'N/I'}, ` +
      `empregado(a) da ${inviteInfo?.company_name || 'EMPRESA'} (CNPJ nº ${inviteInfo?.company_cnpj || 'N/I'}), doravante denominada CONVENIADA, declaro, para todos os fins de direito, que, ` +
      `de forma livre, voluntária, expressa, prévia e inequívoca, manifesto minha adesão ao Convênio Comercial celebrado entre a CONVENIADA ` +
      `e a OXX PHARMA MAGISTRAL LTDA., CNPJ nº 03.446.178/0001-59, doravante denominada OXX PHARMA.\n\n` +
      `Declaro que conheço e compreendo as condições do Convênio Comercial, estando ciente de que minha adesão é facultativa e autorizo o desconto dos valores das aquisições realizadas em minha folha de pagamento.\n\n` +
      `Declaro estar ciente de que os dados necessários à operacionalização das aquisições poderão ser tratados e compartilhados entre a CONVENIADA e a OXX PHARMA.\n\n` +
      `Maringá, datado eletronicamente.`;

    setRenderedTermsText(defaultTerms);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollTerms = () => {
    if (!scrollRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAcceptTermsAndSubmit = async () => {
    if (!acceptedTerms) {
      toast.error('Você precisa marcar a caixa confirmando o aceite do Termo.');
      return;
    }

    setSubmittingTerms(true);

    // Captura metadados do ambiente
    const userAgent = navigator.userAgent;
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const language = navigator.language;
    const platform = navigator.platform;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    let geolocation = null;
    try {
      if ('geolocation' in navigator) {
        geolocation = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(null),
            { timeout: 3000 }
          );
        });
      }
    } catch {
      geolocation = null;
    }

    const payload = {
      token,
      cpf,
      phone,
      address: {
        zip_code: zipCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
      },
      password,
      audit_metadata: {
        user_agent: userAgent,
        screen_resolution: screenRes,
        language,
        platform,
        timezone,
        geolocation,
      },
    };

    try {
      const res = await api.post('/api/convenio/complete-registration', payload);
      toast.success(res.message || 'Termos aceitos! Código de verificação enviado por e-mail.');
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.message || 'Erro ao finalizar cadastro e aceitar termos');
    } finally {
      setSubmittingTerms(false);
    }
  };

  const handleVerifyCodeSubmit = async (e) => {
    e?.preventDefault();
    if (!verificationCode || verificationCode.trim().length !== 6) {
      toast.error('Digite o código de 6 dígitos.');
      return;
    }

    setVerifyingCode(true);
    try {
      const res = await api.post('/api/convenio/verify-code', {
        token,
        code: verificationCode.trim(),
      });

      if (res.access_token) {
        localStorage.setItem('token', res.access_token);
        if (loginWithToken) {
          loginWithToken(res.access_token, res.user);
        }
      }

      toast.success('Conta ativada com sucesso! Redirecionando para a loja...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (err) {
      toast.error(err.message || 'Código incorreto ou expirado');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    setResendingCode(true);
    try {
      const res = await api.post('/api/convenio/resend-code', { token });
      toast.success(res.message || 'Novo código enviado por e-mail!');
    } catch (err) {
      toast.error(err.message || 'Falha ao reenviar código');
    } finally {
      setResendingCode(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-brand-main mx-auto" />
          <p className="text-sm text-txt-secondary font-medium">Carregando convite...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="font-heading font-black text-xl text-txt-primary">Link de Convite Inválido</h2>
          <p className="text-sm text-txt-secondary">{errorMsg}</p>
          <Button onClick={() => navigate('/')} className="w-full">
            Ir para a Página Inicial
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50/30 py-10 px-4" data-testid="complete-registration-page">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-600 text-white font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-wider shadow-sm">
            <ShieldCheck className="w-4 h-4" /> Convênio Empresarial OxxPharma
          </div>
          <h1 className="font-heading font-black text-3xl text-txt-primary">
            Ativação do seu Cadastro
          </h1>
          <p className="text-sm text-txt-secondary">
            Empresa Conveniada: <strong className="text-emerald-800">{inviteInfo?.company_name}</strong>
          </p>
        </div>

        {/* Stepper Bar */}
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <div className={`p-2.5 rounded-xl border transition-all ${step === 1 ? 'bg-brand-main text-white border-brand-main shadow' : step > 1 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-bg-secondary text-txt-secondary border-border'}`}>
              1. Seus Dados Pessoais
            </div>
            <div className={`p-2.5 rounded-xl border transition-all ${step === 2 ? 'bg-brand-main text-white border-brand-main shadow' : step > 2 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-bg-secondary text-txt-secondary border-border'}`}>
              2. Termo de Adesão
            </div>
            <div className={`p-2.5 rounded-xl border transition-all ${step === 3 ? 'bg-brand-main text-white border-brand-main shadow' : 'bg-bg-secondary text-txt-secondary border-border'}`}>
              3. Validação por E-mail
            </div>
          </div>
        </div>

        {/* STEP 1: FORMULARIO DE DADOS */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="bg-white rounded-2xl border border-border p-6 md:p-8 shadow-xl space-y-6">
            
            {/* Card de Identificação pré-preenchida */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs space-y-1.5 text-emerald-950">
              <div className="font-bold uppercase tracking-wider text-emerald-800 text-[11px] mb-1">
                Sua Conta Vinculada ao RH:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div><strong>Nome:</strong> {inviteInfo?.name}</div>
                <div><strong>E-mail:</strong> {inviteInfo?.email}</div>
                <div><strong>Matrícula Funcional:</strong> <span className="font-mono bg-emerald-200/60 px-1.5 py-0.5 rounded font-bold">{inviteInfo?.registration_number || 'N/I'}</span></div>
                <div><strong>Empresa:</strong> {inviteInfo?.company_name}</div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-heading font-black text-lg text-txt-primary border-b border-border pb-2">
                Complete seus Dados Pessoais & Senha
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="CPF*"
                  required
                  value={formatCpf(cpf)}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  data-testid="input-cpf"
                />
                <Input
                  label="Telefone / Celular*"
                  required
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  data-testid="input-phone"
                />
              </div>

              {/* Endereço */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-txt-secondary flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-brand-main" /> Endereço de Entrega
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Input
                      label="CEP*"
                      required
                      value={formatZip(zipCode)}
                      onChange={(e) => setZipCode(e.target.value)}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      maxLength={9}
                      data-testid="input-zip"
                    />
                    {fetchingCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-9 text-brand-main" />}
                  </div>
                  <Input className="md:col-span-2" label="Rua / Logradouro*" required value={street} onChange={(e) => setStreet(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Número*" required value={number} onChange={(e) => setNumber(e.target.value)} />
                  <Input label="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, Bloco..." />
                  <Input label="Bairro*" required value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input className="md:col-span-2" label="Cidade*" required value={city} onChange={(e) => setCity(e.target.value)} />
                  <Input label="UF*" required value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-txt-secondary flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-brand-main" /> Crie sua Senha de Acesso
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Senha de Acesso*"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    data-testid="input-password"
                  />
                  <Input
                    label="Confirme sua Senha*"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="submit" size="lg" className="bg-brand-main hover:bg-brand-hover text-white font-bold">
                Avançar para o Termo de Adesão <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: LEITURA E ACEITE DO TERMO */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-border p-6 md:p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border pb-4">
              <div>
                <h3 className="font-heading font-black text-xl text-txt-primary flex items-center gap-2">
                  <FileText className="w-6 h-6 text-brand-main" /> Termo de Adesão e Autorização de Desconto
                </h3>
                <p className="text-xs text-txt-secondary mt-1">
                  Leia o termo na íntegra para habilitar a confirmação.
                </p>
              </div>

              <div>
                {hasScrolledToBottom ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Leitura Concluída
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300">
                    ↓ Role até o final para habilitar o aceite
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable Terms Box */}
            <div
              ref={scrollRef}
              onScroll={handleScrollTerms}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto text-slate-800 shadow-inner select-none"
              data-testid="terms-scroll-container"
            >
              {renderedTermsText}
            </div>

            {/* Checkbox */}
            <div className={`p-4 rounded-xl border transition-all ${hasScrolledToBottom ? 'bg-emerald-50/60 border-emerald-300' : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!hasScrolledToBottom}
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 text-brand-main border-gray-300 rounded focus:ring-brand-main"
                  data-testid="accept-terms-checkbox"
                />
                <span className="text-sm font-semibold text-txt-primary">
                  Declaro que li integralmente o Termo de Adesão e Autorização de Desconto em Folha acima e aceito de forma livre, voluntária e inequívoca todas as suas condições.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border flex-wrap">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar e Corrigir Dados
              </Button>
              <Button
                onClick={handleAcceptTermsAndSubmit}
                loading={submittingTerms}
                disabled={!acceptedTerms}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg"
                data-testid="submit-terms-btn"
              >
                <ShieldCheck className="w-5 h-5 mr-2" /> Aceitar e Finalizar Cadastro
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: CODIGO DE VERIFICACAO DE 6 DIGITOS */}
        {step === 3 && (
          <form onSubmit={handleVerifyCodeSubmit} className="bg-white rounded-2xl border border-border p-6 md:p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-heading font-black text-2xl text-txt-primary">
                Digite o Código de Verificação
              </h3>
              <p className="text-sm text-txt-secondary mt-2">
                Enviamos um código de 6 dígitos para o e-mail: <strong className="text-emerald-800">{inviteInfo?.email}</strong>.
              </p>
            </div>

            <div className="max-w-xs mx-auto">
              <Input
                className="text-center font-mono text-2xl tracking-[8px] font-bold h-14"
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                data-testid="verification-code-input"
              />
              <p className="text-xs text-txt-secondary mt-2">
                O código expira em 15 minutos.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Button type="submit" loading={verifyingCode} size="lg" className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Validar e Acessar a Loja
              </Button>

              <div>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendingCode}
                  className="text-xs text-brand-main font-semibold hover:underline inline-flex items-center gap-1"
                >
                  {resendingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Reenviar Código de Verificação por E-mail
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
