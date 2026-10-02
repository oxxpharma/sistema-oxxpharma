import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Save, Settings as SettingsIcon, Loader2, Percent, Award, Wallet, Building2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s = await api.get('/api/admin/settings');
      setSettings(s);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        affiliate_commission_rate: parseFloat(settings.affiliate_commission_rate),
        network1_generations: (settings.network1_generations || []).map(x => parseFloat(x) || 0),
        network2_generations: (settings.network2_generations || []).map(x => parseFloat(x) || 0),
        propaganda_threshold_referrals: parseInt(settings.propaganda_threshold_referrals, 10) || 0,
        propaganda_threshold_period_days: parseInt(settings.propaganda_threshold_period_days, 10) || 30,
        withdrawal_enabled: !!settings.withdrawal_enabled,
        withdrawal_min_amount: parseFloat(settings.withdrawal_min_amount) || 0,
        withdrawal_release_days: parseInt(settings.withdrawal_release_days, 10) || 0,
        company_name: settings.company_name || '',
        company_cnpj: settings.company_cnpj || '',
        company_address: settings.company_address || '',
        company_city: settings.company_city || '',
        company_state: settings.company_state || '',
        company_zip: settings.company_zip || '',
        company_phone: settings.company_phone || '',
        company_email: settings.company_email || '',
        invoice_prefix: settings.invoice_prefix || 'OXX',
        // Iter 61: WhatsApp de vendas
        whatsapp_enabled: !!settings.whatsapp_enabled,
        whatsapp_number: (settings.whatsapp_number || '').replace(/\D/g, ''),
        whatsapp_message_template: settings.whatsapp_message_template || '',
        payroll_terms_text: settings.payroll_terms_text || '',
      };
      const updated = await api.put('/api/admin/settings', payload);
      setSettings(updated);
      toast.success('Configurações salvas');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const updateGen = (key, idx, val) => {
    const arr = [...(settings[key] || [0, 0, 0, 0, 0, 0])];
    arr[idx] = val;
    setSettings({ ...settings, [key]: arr });
  };

  if (loading || !settings) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-settings">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3"><SettingsIcon className="w-7 h-7 text-brand-main" /> Configurações</h1>
          <p className="text-sm text-txt-secondary mt-1">Cashbacks, promoção a Propagandista e saques.</p>
        </div>
        <Button onClick={save} loading={saving} data-testid="save-settings"><Save className="w-4 h-4" /> Salvar</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Afiliado */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-4"><Percent className="w-5 h-5 text-brand-main" /> Cashback de Indicação (link)</h2>
          <Input
            label="Taxa sobre subtotal (ex: 0.08 = 8%)"
            type="number" step="0.001"
            value={settings.affiliate_commission_rate}
            onChange={e => setSettings({ ...settings, affiliate_commission_rate: e.target.value })}
            hint="Pago ao sponsor direto em TODA compra, independente da rede."
            data-testid="affiliate-rate"
          />
        </div>

        {/* Promoção a Propagandista */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-4"><Award className="w-5 h-5 text-brand-main" /> Critério de promoção a Propagandista</h2>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mínimo de indicações" type="number" value={settings.propaganda_threshold_referrals} onChange={e => setSettings({ ...settings, propaganda_threshold_referrals: e.target.value })} data-testid="threshold-referrals" />
            <Input label="Período (dias)" type="number" value={settings.propaganda_threshold_period_days} onChange={e => setSettings({ ...settings, propaganda_threshold_period_days: e.target.value })} data-testid="threshold-days" />
          </div>
          <p className="text-xs text-txt-secondary mt-2">
            Clientes com ≥ {settings.propaganda_threshold_referrals} indicações nos últimos {settings.propaganda_threshold_period_days} dias aparecerão como candidatos.
          </p>
        </div>
      </div>

      {/* Equipe 1 & 2 */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg mb-1">Equipe 1 — Corporativa (importada)</h2>
          <p className="text-xs text-txt-secondary mb-4">Percentuais sobre subtotal da venda, por geração.</p>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Input
                key={`n1-${i}`}
                label={`${i + 1}ª geração (%)`}
                type="number" step="0.01"
                value={settings.network1_generations?.[i] ?? 0}
                onChange={e => updateGen('network1_generations', i, e.target.value)}
                data-testid={`n1-gen-${i + 1}`}
              />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg mb-1">Equipe 2 — Propagandistas</h2>
          <p className="text-xs text-txt-secondary mb-4">Percentuais para usuários promovidos organicamente.</p>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Input
                key={`n2-${i}`}
                label={`${i + 1}ª geração (%)`}
                type="number" step="0.01"
                value={settings.network2_generations?.[i] ?? 0}
                onChange={e => updateGen('network2_generations', i, e.target.value)}
                data-testid={`n2-gen-${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Saques */}
      <div className="bg-white rounded-xl border border-border p-6 mt-6">
        <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-4"><Wallet className="w-5 h-5 text-brand-main" /> Saques (PIX)</h2>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={!!settings.withdrawal_enabled} onChange={e => setSettings({ ...settings, withdrawal_enabled: e.target.checked })} data-testid="withdrawal-enabled" />
          <span className="font-semibold">Ativar saques</span>
          <span className="text-xs text-txt-secondary">(quando ativo, usuários podem solicitar saque via PIX)</span>
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Valor mínimo de saque (R$)" type="number" step="0.01" value={settings.withdrawal_min_amount} onChange={e => setSettings({ ...settings, withdrawal_min_amount: e.target.value })} />
          <Input label="Dias para liberação após pagamento" type="number" value={settings.withdrawal_release_days} onChange={e => setSettings({ ...settings, withdrawal_release_days: e.target.value })} hint="Tempo de quarentena antes da cashback liberar para saque" />
        </div>
      </div>

      {/* Empresa (para nota de faturamento) */}
      <div className="bg-white rounded-xl border border-border p-6 mt-6">
        <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-1"><Building2 className="w-5 h-5 text-brand-main" /> Dados da empresa</h2>
        <p className="text-xs text-txt-secondary mb-4">Aparecem no cabeçalho das notas de faturamento.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Razão social" value={settings.company_name || ''} onChange={e => setSettings({ ...settings, company_name: e.target.value })} data-testid="company-name" />
          <Input label="CNPJ" value={settings.company_cnpj || ''} onChange={e => setSettings({ ...settings, company_cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          <Input label="Endereço" className="md:col-span-2" value={settings.company_address || ''} onChange={e => setSettings({ ...settings, company_address: e.target.value })} />
          <Input label="Cidade" value={settings.company_city || ''} onChange={e => setSettings({ ...settings, company_city: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="UF" value={settings.company_state || ''} onChange={e => setSettings({ ...settings, company_state: e.target.value })} maxLength={2} />
            <Input label="CEP" value={settings.company_zip || ''} onChange={e => setSettings({ ...settings, company_zip: e.target.value })} />
          </div>
          <Input label="Telefone" value={settings.company_phone || ''} onChange={e => setSettings({ ...settings, company_phone: e.target.value })} />
          <Input label="Email" value={settings.company_email || ''} onChange={e => setSettings({ ...settings, company_email: e.target.value })} />
          <Input label="Prefixo do nº da nota" className="md:col-span-2" value={settings.invoice_prefix || ''} onChange={e => setSettings({ ...settings, invoice_prefix: e.target.value })} hint={`Exemplo atual: ${settings.invoice_prefix || 'OXX'}-000001`} />
        </div>
      </div>

      {/* Iter 61: WhatsApp de vendas */}
      <div className="bg-white rounded-xl border border-border p-6 mt-6" data-testid="whatsapp-settings">
        <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-1"><MessageCircle className="w-5 h-5 text-[#25D366]" /> Botão "Comprar pelo WhatsApp"</h2>
        <p className="text-xs text-txt-secondary mb-4">Se ativo, aparece um botão verde na página de cada produto que abre uma conversa no WhatsApp já com a mensagem preenchida.</p>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={!!settings.whatsapp_enabled} onChange={e => setSettings({ ...settings, whatsapp_enabled: e.target.checked })} data-testid="whatsapp-enabled" />
          <span className="font-semibold">Ativar botão nos produtos</span>
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Número do WhatsApp (com DDI, só dígitos)" value={settings.whatsapp_number || ''} onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })} placeholder="Ex: 5511999998888" data-testid="whatsapp-number" hint="Formato E.164 sem sinal. Ex: 55 + DDD + número." />
        </div>
        <div className="mt-3">
          <label className="text-sm font-bold text-txt-secondary block mb-1">Template da mensagem</label>
          <textarea
            rows={4}
            value={settings.whatsapp_message_template || ''}
            onChange={e => setSettings({ ...settings, whatsapp_message_template: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono"
            placeholder="Olá! Tenho interesse no produto *{product_name}* — R$ {product_price}. Link: {product_url}"
            data-testid="whatsapp-template"
          />
          <p className="text-xs text-txt-secondary mt-1">Variáveis disponíveis: <code>{'{product_name}'}</code>, <code>{'{product_price}'}</code>, <code>{'{product_url}'}</code>, <code>{'{quantity}'}</code></p>
        </div>
      </div>

      {/* Convênio: Termo de Adesão e Autorização de Desconto em Folha */}
      <div className="bg-white rounded-xl border border-border p-6 mt-6" data-testid="payroll-terms-settings">
        <h2 className="font-heading font-black text-lg flex items-center gap-2 mb-1">
          📜 Termo de Adesão e Autorização de Desconto em Folha (Convênio)
        </h2>
        <p className="text-xs text-txt-secondary mb-4">
          Este texto é exibido em uma caixa rolável no checkout do funcionário ao selecionar "Desconto em folha".
          No momento do aceite, os marcadores <code>@variável</code> são substituídos pelos dados reais do funcionário e do pedido.
        </p>

        {/* Chips de Variáveis */}
        <div className="mb-3">
          <label className="text-xs font-bold text-txt-primary block mb-1.5">
            Clique em uma variável para copiar ou inserir no texto do termo:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { code: '@nomecompleto', label: 'Nome do Funcionário' },
              { code: '@cpf', label: 'CPF' },
              { code: '@matricula', label: 'Matrícula Funcional' },
              { code: '@empresa', label: 'Empresa Credenciada' },
              { code: '@cnpj', label: 'CNPJ Empresa' },
              { code: '@valor', label: 'Valor do Pedido' },
              { code: '@parcelas', label: 'Parcelamento' },
              { code: '@datahora', label: 'Data e Hora' },
            ].map(varChip => (
              <button
                key={varChip.code}
                type="button"
                onClick={() => {
                  const current = settings.payroll_terms_text || '';
                  setSettings({ ...settings, payroll_terms_text: current + ' ' + varChip.code });
                  toast.info(`Variável ${varChip.code} adicionada ao texto!`);
                }}
                className="text-xs bg-slate-100 hover:bg-brand-light hover:text-brand-main text-slate-800 font-mono font-semibold px-2.5 py-1 rounded-lg border border-slate-300 transition flex items-center gap-1"
                title={`Inserir ${varChip.code} (${varChip.label})`}
              >
                <span>{varChip.code}</span>
                <span className="text-[10px] text-slate-500 font-normal font-sans">({varChip.label})</span>
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={12}
          value={settings.payroll_terms_text || ''}
          onChange={e => setSettings({ ...settings, payroll_terms_text: e.target.value })}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-xs font-mono leading-relaxed bg-slate-50 shadow-inner focus:bg-white focus:ring-2 focus:ring-brand-main"
          placeholder="ANEXO I - TERMO DE ADESÃO E AUTORIZAÇÃO DE DESCONTO..."
          data-testid="payroll-terms-template-editor"
        />
        <div className="flex justify-between items-center mt-2 text-xs text-txt-secondary">
          <span>Campos entre <code>@...</code> ou <code>{'{...}'}</code> serão preenchidos dinamicamente pelo sistema.</span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Restaurar o modelo padrão do Termo de Adesão da OxxPharma?')) {
                setSettings({
                  ...settings,
                  payroll_terms_text: `ANEXO I - TERMO DE ADESÃO E AUTORIZAÇÃO DE DESCONTO\n\nPelo presente instrumento, eu, @nomecompleto, inscrito(a) no CPF sob nº @cpf, matrícula funcional nº @matricula, empregado(a) da @empresa (CNPJ nº @cnpj), doravante denominada CONVENIADA, declaro, para todos os fins de direito, que, de forma livre, voluntária, expressa, prévia e inequívoca, manifesto minha adesão ao Convênio Comercial celebrado entre a CONVENIADA e a OXX PHARMA MAGISTRAL LTDA., CNPJ nº 03.446.178/0001-59, doravante denominada OXX PHARMA, tendo por objeto a disponibilização de condições comerciais diferenciadas para aquisição de produtos, nos termos do instrumento principal.\n\nDeclaro que conheço e compreendo as condições do Convênio Comercial, bem como as condições comerciais aplicáveis às aquisições realizadas junto à OXX PHARMA, estando ciente de que minha adesão é facultativa e não constitui condição para minha admissão, permanência, promoção ou progressão profissional, inexistindo qualquer obrigação de aquisição de produtos.\n\nEm caráter individual e específico, AUTORIZO EXPRESSAMENTE a CONVENIADA a efetuar, em minha folha de pagamento, os descontos correspondentes aos valores por mim efetivamente devidos em razão das aquisições realizadas no âmbito do referido Convênio (no valor total de @valor em @parcelas), observados os valores informados pela OXX PHARMA, os limites legais, regulamentares e convencionais aplicáveis e a efetiva disponibilidade para processamento em folha.\n\nA presente autorização restringe-se aos valores decorrentes de aquisições realizadas por mim no âmbito do Convênio Comercial, não abrangendo quaisquer obrigações estranhas à relação comercial estabelecida com a OXX PHARMA. Eventual impossibilidade de desconto integral, por qualquer motivo, não implicará autorização para descontos superiores aos legalmente permitidos, devendo eventual saldo remanescente ser tratado diretamente entre as partes interessadas.\n\nA presente autorização permanecerá válida enquanto perdurar minha participação no Convênio, podendo ser revogada mediante comunicação escrita à CONVENIADA, produzindo efeitos para as obrigações futuras após a efetiva ciência da revogação, sem prejuízo dos valores regularmente constituídos anteriormente à sua efetivação.\n\nDeclaro estar ciente de que os dados necessários à operacionalização das aquisições e dos respectivos descontos poderão ser tratados e compartilhados entre a CONVENIADA e a OXX PHARMA, exclusivamente para as finalidades relacionadas ao Convênio, observada a legislação aplicável de proteção de dados pessoais.\n\nPor fim, declaro que li integralmente o presente Termo, que tive ciência de seu conteúdo e que minha adesão e autorização são prestadas de forma livre e consciente, sem qualquer vício de consentimento.\n\nMaringá, @datahora.`
                });
                toast.success('Modelo padrão do termo restaurado!');
              }
            }}
            className="text-brand-main font-semibold hover:underline"
          >
            Restaurar modelo padrão
          </button>
        </div>
      </div>
    </div>
  );
}
