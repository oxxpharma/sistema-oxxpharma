import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import useCep, { maskCep } from '../../hooks/useCep';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, MapPin, UserCheck, CreditCard,
  Percent, Search, Save, Eye, EyeOff
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const COMMON_BANKS = [
  '001 - Banco do Brasil S.A.',
  '237 - Banco Bradesco S.A.',
  '341 - Itaú Unibanco S.A.',
  '033 - Banco Santander (Brasil) S.A.',
  '104 - Caixa Econômica Federal',
  '260 - Nu Pagamentos S.A. (Nubank)',
  '077 - Banco Inter S.A.',
  '336 - Banco C6 S.A.',
  '212 - Banco Original S.A.',
  '655 - Banco Votorantim S.A. (Neon)',
  'Outro Banco / Fintech'
];

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function PropagandistaCompanyCreatePage() {
  const navigate = useNavigate();
  const { lookup: lookupCep, loading: loadingCep } = useCep();

  const [saving, setSaving] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const [form, setForm] = useState({
    // Card 1: Dados Cadastrais
    cnpj: '',
    ie: '',
    status: 'ativa',
    name: '',
    slug: '',
    email: '',
    whatsapp: '',
    // Card 2: Endereço
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    // Card 3: Representante Legal
    rep_name: '',
    rep_role: '',
    rep_cpf: '',
    rep_rg: '',
    rep_phone: '',
    rep_email: '',
    // Card 4: Dados Bancários
    bank_name: '001 - Banco do Brasil S.A.',
    account_type: 'corrente',
    agency: '',
    account_number: '',
    pix_type: 'cnpj',
    pix_key: '',
    bank_favored_name: '',
    // Card 5: Configurações Comerciais
    password: '123456',
    employee_discount_pct: 0,
    payroll_limit_percent: 35,
    payroll_enabled: true,
  });

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !isSlugManuallyEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleSlugChange = (val) => {
    setIsSlugManuallyEdited(true);
    setForm(prev => ({ ...prev, slug: slugify(val) }));
  };

  // Busca de CNPJ via BrasilAPI
  const handleCnpjSearch = async () => {
    const raw = (form.cnpj || '').replace(/\D/g, '');
    if (raw.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos para pesquisar.');
      return;
    }
    setSearchingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (!res.ok) throw new Error('CNPJ não encontrado ou serviço indisponível.');
      const data = await res.json();

      const razao = data.razao_social || data.nome_fantasia || '';
      const autoSlug = slugify(razao);

      setForm(prev => ({
        ...prev,
        name: razao || prev.name,
        slug: isSlugManuallyEdited ? prev.slug : autoSlug,
        email: data.email || prev.email,
        whatsapp: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.whatsapp,
        cep: data.cep ? maskCep(data.cep) : prev.cep,
        street: data.logradouro || prev.street,
        number: data.numero || prev.number,
        complement: data.complemento || prev.complement,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));
      toast.success('Dados do CNPJ importados com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Falha ao buscar dados do CNPJ.');
    } finally {
      setSearchingCnpj(false);
    }
  };

  // Busca de CEP via ViaCEP
  const handleCepSearch = async () => {
    if (!form.cep) {
      toast.error('Informe o CEP.');
      return;
    }
    const addr = await lookupCep(form.cep);
    if (addr) {
      setForm(prev => ({
        ...prev,
        cep: addr.zip_code || prev.cep,
        street: addr.street || prev.street,
        neighborhood: addr.neighborhood || prev.neighborhood,
        city: addr.city || prev.city,
        state: addr.state || prev.state,
        complement: addr.complement || prev.complement,
      }));
      toast.success('Endereço localizado via CEP!');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Preencha a Razão Social / Nome da Empresa.');
      return;
    }
    if (!form.cnpj.trim()) {
      toast.error('Preencha o CNPJ.');
      return;
    }

    const representativeEmail = form.rep_email || form.email;
    if (!representativeEmail) {
      toast.error('Informe ao menos o E-mail Principal ou o E-mail do Representante (login da empresa).');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email || representativeEmail,
        rep_email: representativeEmail,
        employee_discount_pct: parseFloat(form.employee_discount_pct) || 0,
        payroll_limit_percent: parseFloat(form.payroll_limit_percent) || 35,
        address: {
          cep: form.cep,
          street: form.street,
          number: form.number,
          complement: form.complement,
          neighborhood: form.neighborhood,
          city: form.city,
          state: form.state,
        }
      };

      const res = await api.post('/api/propagandista/companies', payload);
      toast.success(`Empresa ${res.name} cadastrada com sucesso! Login: ${res.representative_credentials?.email}`);
      navigate('/propagandista/empresas');
    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar empresa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16" data-testid="propagandista-company-create-page">
      {/* Cabeçalho da Página */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            to="/propagandista/empresas"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-txt-secondary hover:text-brand-main mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Minhas Empresas
          </Link>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary flex items-center gap-2">
            Cadastrar Nova Empresa Credenciada
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Preencha a ficha cadastral completa para integrar a empresa ao seu sistema de convênio.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* CARD 1: DADOS CADASTRAIS DA EMPRESA */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-main flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-txt-primary">Dados Cadastrais da Empresa</h2>
              <p className="text-xs text-txt-secondary">Informações fiscais e identificação principal</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-txt-primary mb-1">CNPJ *</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="00.000.000/0001-00"
                    required
                    value={form.cnpj}
                    onChange={e => handleChange('cnpj', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCnpjSearch}
                    loading={searchingCnpj}
                    className="shrink-0 text-xs gap-1.5"
                    title="Buscar dados da empresa via BrasilAPI"
                  >
                    <Search className="w-3.5 h-3.5" /> Buscar CNPJ
                  </Button>
                </div>
              </div>

              <div>
                <Input
                  label="Inscrição Estadual (I.E.)"
                  placeholder="Isento ou nº da I.E."
                  value={form.ie}
                  onChange={e => handleChange('ie', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Razão Social / Nome da Empresa *"
                  required
                  placeholder="Ex: Farmácia & Cia Ltda"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-primary mb-1">Status da Franquia</label>
                <select
                  value={form.status}
                  onChange={e => handleChange('status', e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
                >
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                  <option value="pendente">Pendente de Contrato</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  label="Slug / Identificador URL *"
                  required
                  placeholder="empresa-xyz"
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  hint="Nome simplificado para link único"
                />
              </div>

              <div>
                <Input
                  label="E-mail Principal"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="Telefone / WhatsApp"
                  placeholder="(11) 98765-4321"
                  value={form.whatsapp}
                  onChange={e => handleChange('whatsapp', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: ENDEREÇO DA EMPRESA */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-txt-primary">Endereço da Empresa</h2>
              <p className="text-xs text-txt-secondary">Localização da sede ou unidade principal</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-txt-primary mb-1">CEP</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={e => handleChange('cep', maskCep(e.target.value))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCepSearch}
                    loading={loadingCep}
                    className="shrink-0 text-xs px-2.5"
                    title="Buscar endereço via ViaCEP"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2">
                <Input
                  label="Logradouro / Rua"
                  placeholder="Av. Paulista, Rua das Flores..."
                  value={form.street}
                  onChange={e => handleChange('street', e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="Número"
                  placeholder="123 ou S/N"
                  value={form.number}
                  onChange={e => handleChange('number', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  label="Complemento"
                  placeholder="Sala 402, Bloco B..."
                  value={form.complement}
                  onChange={e => handleChange('complement', e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="Bairro"
                  placeholder="Centro, Vila Nova..."
                  value={form.neighborhood}
                  onChange={e => handleChange('neighborhood', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    label="Cidade"
                    placeholder="São Paulo..."
                    value={form.city}
                    onChange={e => handleChange('city', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-primary mb-1">UF</label>
                  <select
                    value={form.state}
                    onChange={e => handleChange('state', e.target.value)}
                    className="w-full h-10 px-2 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
                  >
                    {BRAZILIAN_STATES.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: REPRESENTANTE LEGAL DA EMPRESA */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-txt-primary">Representante Legal da Empresa</h2>
              <p className="text-xs text-txt-secondary">Pessoa responsável pela gestão da empresa e acesso ao portal de convênio</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nome Completo do Representante *"
                required
                placeholder="Ex: Carlos Eduardo da Silva"
                value={form.rep_name}
                onChange={e => handleChange('rep_name', e.target.value)}
              />

              <Input
                label="Cargo / Função"
                placeholder="Ex: Diretor de RH, Gerente Geral..."
                value={form.rep_role}
                onChange={e => handleChange('rep_role', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Input
                  label="CPF do Representante *"
                  required
                  placeholder="000.000.000-00"
                  value={form.rep_cpf}
                  onChange={e => handleChange('rep_cpf', e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="RG do Representante"
                  placeholder="00.000.000-0"
                  value={form.rep_rg}
                  onChange={e => handleChange('rep_rg', e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="Telefone / Celular"
                  placeholder="(11) 99999-8888"
                  value={form.rep_phone}
                  onChange={e => handleChange('rep_phone', e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="E-mail do Representante *"
                  type="email"
                  required
                  placeholder="representante@empresa.com"
                  value={form.rep_email}
                  onChange={e => handleChange('rep_email', e.target.value)}
                  hint="Será o usuário de login no portal"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: DADOS BANCÁRIOS PARA REPASSE DE COMISSÕES */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-txt-primary">Dados Bancários para Repasse de Comissões</h2>
              <p className="text-xs text-txt-secondary">Conta bancária ou Chave PIX para pagamentos e faturamento</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-txt-primary mb-1">Nome do Banco</label>
                <select
                  value={form.bank_name}
                  onChange={e => handleChange('bank_name', e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
                >
                  {COMMON_BANKS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-primary mb-1">Tipo de Conta</label>
                <select
                  value={form.account_type}
                  onChange={e => handleChange('account_type', e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
                >
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Conta Poupança</option>
                  <option value="pagamento">Conta Pagamento / Digital</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Agência"
                  placeholder="0001"
                  value={form.agency}
                  onChange={e => handleChange('agency', e.target.value)}
                />
                <Input
                  label="Nº Conta"
                  placeholder="12345-6"
                  value={form.account_number}
                  onChange={e => handleChange('account_number', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-txt-primary mb-1">Tipo de Chave PIX</label>
                <select
                  value={form.pix_type}
                  onChange={e => handleChange('pix_type', e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
                >
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone / Celular</option>
                  <option value="random">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <Input
                  label="Chave PIX"
                  placeholder="Informe a chave PIX..."
                  value={form.pix_key}
                  onChange={e => handleChange('pix_key', e.target.value)}
                />
              </div>

              <div>
                <Input
                  label="Nome do Titular / Favorecido"
                  placeholder="Razão Social ou Nome do Favorecido"
                  value={form.bank_favored_name}
                  onChange={e => handleChange('bank_favored_name', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 5: CONFIGURAÇÕES COMERCIAIS / CONVÊNIO */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-txt-primary">Configurações Comerciais do Convênio</h2>
              <p className="text-xs text-txt-secondary">Defina os benefícios de desconto dos funcionários e a senha inicial de acesso</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-txt-primary mb-1">Senha Inicial de Acesso *</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={e => handleChange('password', e.target.value)}
                    placeholder="123456"
                    hint="Senha para o 1º acesso do representante"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-txt-secondary hover:text-txt-primary"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Input
                  label="Desconto para Funcionários (%)"
                  type="number"
                  step="0.5"
                  min="0"
                  max="15"
                  value={form.employee_discount_pct}
                  onChange={e => handleChange('employee_discount_pct', e.target.value)}
                  hint="Desconto repassado no checkout (0 a 15%)"
                />
              </div>

              <div>
                <Input
                  label="Limite Desconto em Folha (%)"
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={form.payroll_limit_percent}
                  onChange={e => handleChange('payroll_limit_percent', e.target.value)}
                  hint="% máx do salário para margem consignada (padrão: 35%)"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <label className="inline-flex items-center gap-3 text-sm font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.payroll_enabled}
                  onChange={e => handleChange('payroll_enabled', e.target.checked)}
                  className="w-4 h-4 rounded text-brand-main focus:ring-brand-main border-border"
                />
                Habilitar opção de Pagamento em Desconto em Folha de Salário
              </label>
              <p className="text-xs text-txt-secondary ml-7 mt-0.5">
                Permite aos funcionários da empresa selecionarem o pagamento com desconto em folha durante o checkout da loja.
              </p>
            </div>
          </div>
        </div>

        {/* BARRA DE AÇÕES INFERIOR */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/propagandista/empresas')}
            disabled={saving}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            loading={saving}
            data-testid="submit-company-page-btn"
            className="px-6"
          >
            <Save className="w-4 h-4 mr-1.5" /> Cadastrar Empresa
          </Button>
        </div>

      </form>
    </div>
  );
}
