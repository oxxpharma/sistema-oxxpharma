import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { ArrowLeft, Save, Loader2, Trash2, Plus, Upload, Download, UserCheck, ShieldCheck, Key, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const empty = {
  name: '', cnpj: '', email: '', contact_name: '', contact_phone: '',
  discount_percent: 0, discount_max_units: '', payroll_enabled: false, payroll_limit_percent: 35,
  commission_company_percent: 0, propagandista_id: '', contract_url: '', notes: '', active: true,
};

export default function AdminCompanyForm() {
  const nav = useNavigate();
  const { companyId } = useParams();
  const isEdit = !!companyId;
  const [form, setForm] = useState(empty);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', email: '', cpf: '', phone: '', position: '', salary: 0 });
  const [submittingEmp, setSubmittingEmp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [tab, setTab] = useState('dados');
  const [confirmModal, setConfirmModal] = useState(null);

  // Estado para cadastro do Usuário Responsável (Company Admin)
  const [showRepModal, setShowRepModal] = useState(false);
  const [repForm, setRepForm] = useState({ name: '', email: '', cpf: '', phone: '', password: '123456' });
  const [createdRepCredentials, setCreatedRepCredentials] = useState(null);
  const [submittingRep, setSubmittingRep] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!isEdit) return;
    const r = await api.get(`/api/company/employees?company_id=${companyId}`);
    setEmployees(r.employees || []);
  }, [companyId, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    (async () => {
      try {
        const c = await api.get(`/api/admin/companies/${companyId}`);
        setForm({ ...empty, ...c });
        await loadEmployees();
      } catch (err) { toast.error(err.message); }
      finally { setLoading(false); }
    })();
  }, [companyId, isEdit, loadEmployees]);

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        discount_percent: parseFloat(form.discount_percent) || 0,
        discount_max_units: form.discount_max_units === '' || form.discount_max_units === null ? null : parseInt(form.discount_max_units, 10),
        payroll_limit_percent: parseFloat(form.payroll_limit_percent) || 0,
        commission_company_percent: parseFloat(form.commission_company_percent) || 0,
      };
      if (isEdit) {
        await api.put(`/api/admin/companies/${companyId}`, payload);
        toast.success('Empresa atualizada');
      } else {
        const created = await api.post('/api/admin/companies', payload);
        toast.success('Empresa criada');
        nav(`/backoffice/convenio/${created.company_id}`);
        return;
      }
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!window.confirm('Excluir esta empresa? (Só é possível se não tiver funcionários)')) return;
    try {
      await api.del(`/api/admin/companies/${companyId}`);
      toast.success('Empresa excluída');
      nav('/backoffice/convenio');
    } catch (err) { toast.error(err.message); }
  };

  const addEmployee = async (e, confirmLink = false) => {
    e?.preventDefault();
    setSubmittingEmp(true);
    try {
      const payload = { ...empForm, salary: parseFloat(empForm.salary) || 0 };
      const url = `/api/company/employees?company_id=${companyId}${confirmLink ? '&confirm_link=true' : ''}`;
      const res = await api.post(url, payload);

      if (res.needs_confirmation) {
        setConfirmModal(res);
        return;
      }

      if (res.user_linked) {
        toast.success(`Conta de usuário existente (${res.email}) vinculada como funcionário com sucesso!`);
      } else {
        toast.success('Novo funcionário adicionado e conta criada no sistema!');
      }

      setShowEmpForm(false);
      setConfirmModal(null);
      setEmpForm({ name: '', email: '', cpf: '', phone: '', position: '', salary: 0 });
      await loadEmployees();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingEmp(false);
    }
  };

  const delEmployee = async (id) => {
    if (!window.confirm('Excluir funcionário?')) return;
    try {
      await api.del(`/api/company/employees/${id}`);
      toast.success('Removido');
      await loadEmployees();
    } catch (err) { toast.error(err.message); }
  };

  const downloadTemplate = async () => {
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/company/employees/template.xlsx`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'modelo_funcionarios.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error('Falha ao baixar modelo'); }
  };

  const onImportFile = async (file, dryRun = true) => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/company/employees/import-xlsx?company_id=${companyId}&dry_run=${dryRun}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro no import');
      if (dryRun) {
        setImportPreview({ ...data, file });
      } else {
        toast.success(`Importado: ${data.inserted}, ignorado: ${data.skipped}`);
        setImportPreview(null);
        await loadEmployees();
      }
    } catch (err) { toast.error(err.message); }
    finally { setImporting(false); }
  };

  const handleCreateRepresentative = async (e) => {
    e?.preventDefault();
    setSubmittingRep(true);
    try {
      const res = await api.post(`/api/admin/companies/${companyId}/create-representative`, repForm);
      setCreatedRepCredentials(res.credentials);
      toast.success(`Usuário responsável ${res.name} (${res.email}) cadastrado com sucesso!`);
      setForm(prev => ({ ...prev, contact_name: res.name, representative_user_id: res.representative_user_id }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingRep(false);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;

  return (
    <div data-testid="admin-company-form">
      <button onClick={() => nav('/backoffice/convenio')} className="inline-flex items-center gap-1 text-sm text-txt-secondary hover:text-brand-main mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="font-heading font-black text-3xl text-txt-primary">{isEdit ? form.name || 'Editar empresa' : 'Nova empresa'}</h1>
        {isEdit && <Button variant="outline" onClick={del} data-testid="del-company-btn"><Trash2 className="w-4 h-4" /> Excluir</Button>}
      </div>

      {isEdit && (
        <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
          {[['dados', 'Dados da Empresa'], ['funcionarios', `Funcionários (${employees.length})`], ['import', 'Importar XLSX']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 ${tab === k ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary'}`} data-testid={`tab-${k}`}>{l}</button>
          ))}
        </div>
      )}

      {(!isEdit || tab === 'dados') && (
        <form onSubmit={save} className="space-y-6 bg-white border border-border rounded-xl p-5 shadow-sm">
          <div className="grid md:grid-cols-2 gap-3">
            <Input label="Nome da Empresa*" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="company-name" />
            <Input label="CNPJ*" required value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} data-testid="company-cnpj" />
            <Input label="Email para relatórios e faturas*" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} hint="Recebe o fechamento mensal" />
            <Input label="Contato Comercial / RH" value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            <Input label="Telefone de Contato" value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />

            <div className="md:col-span-2">
              <label className="text-sm font-bold text-txt-secondary block mb-1">Contrato PDF da Empresa</label>
              {form.contract_url ? (
                <div className="flex items-center gap-2 flex-wrap bg-bg-secondary p-3 rounded-lg border border-border">
                  <a href={`${process.env.REACT_APP_BACKEND_URL}${form.contract_url}?auth=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="text-xs text-brand-main font-bold underline flex items-center gap-1">
                    Ver contrato PDF atual <ExternalLink className="w-3 h-3" />
                  </a>
                  <label className="inline-flex items-center gap-1 border border-border bg-white rounded-lg px-3 py-1.5 cursor-pointer text-xs hover:bg-bg-secondary ml-auto">
                    <Upload className="w-3 h-3" /> Substituir PDF
                    <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f || !isEdit) return;
                      const fd = new FormData(); fd.append('file', f);
                      try {
                        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/companies/${companyId}/contract`, {
                          method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd });
                        const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'erro');
                        setForm(f => ({ ...f, contract_url: d.contract_url }));
                        toast.success('Contrato enviado');
                      } catch (err) { toast.error(err.message); }
                    }} />
                  </label>
                </div>
              ) : isEdit ? (
                <label className="inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 cursor-pointer text-sm hover:bg-bg-secondary" data-testid="upload-contract-btn">
                  <Upload className="w-4 h-4 text-brand-main" /> Enviar contrato PDF
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const fd = new FormData(); fd.append('file', f);
                    try {
                      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/companies/${companyId}/contract`, {
                        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd });
                      const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'erro');
                      setForm(f => ({ ...f, contract_url: d.contract_url }));
                      toast.success('Contrato enviado');
                    } catch (err) { toast.error(err.message); }
                  }} />
                </label>
              ) : (
                <div className="text-xs text-txt-secondary italic">Salve a empresa primeiro para enviar o PDF do contrato.</div>
              )}
            </div>
          </div>

          {/* SEÇÃO: USUÁRIO RESPONSÁVEL DA EMPRESA (COMPANY ADMIN) */}
          {isEdit && (
            <div className="border-t border-border pt-4 bg-slate-50 -mx-5 -mb-2 p-5 rounded-b-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-heading font-black text-base text-txt-primary flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Usuário Responsável pela Empresa (Acesso ao Painel /empresa)
                  </h3>
                  <p className="text-xs text-txt-secondary">
                    Este usuário possui acesso exclusivo ao Painel Empresa (/empresa) para consultar faturas, contratar e gerenciar funcionários.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => { setCreatedRepCredentials(null); setShowRepModal(true); }}>
                  <Key className="w-4 h-4 text-emerald-600" /> {form.representative_user_id ? 'Gerar / Alterar Senha do Responsável' : 'Criar Usuário Responsável'}
                </Button>
              </div>

              {form.contact_name && (
                <div className="text-xs bg-white rounded-lg p-3 border border-border flex items-center justify-between">
                  <div>
                    <span className="font-bold text-txt-primary">{form.contact_name}</span>
                    {form.email && <span className="text-txt-secondary ml-2">({form.email})</span>}
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Acesso ao Painel Empresa Habilitado
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Regras Comerciais do Convênio</div>
            <div className="grid md:grid-cols-3 gap-3">
              <Input label="Desconto para funcionários (%)" type="number" step="0.01" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} hint="0-100%" />
              <Input label="Máx unidades c/ desconto por pedido" type="number" step="1" value={form.discount_max_units || ''} onChange={e => setForm({ ...form, discount_max_units: e.target.value })} placeholder="Ilimitado" hint="Limite por pedido" />
              <Input label="Limite consignado (%)" type="number" step="0.01" value={form.payroll_limit_percent} onChange={e => setForm({ ...form, payroll_limit_percent: e.target.value })} hint="Margem consignável mensal (30%)" />
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <Input label="Comissão da empresa (%)" type="number" step="0.01" value={form.commission_company_percent} onChange={e => setForm({ ...form, commission_company_percent: e.target.value })} hint="Comissão multinível da empresa" />
            </div>
            <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer select-none">
              <input type="checkbox" checked={form.payroll_enabled} onChange={e => setForm({ ...form, payroll_enabled: e.target.checked })} data-testid="payroll-enabled" className="accent-emerald-500 w-4 h-4" />
              Habilitar <b>Desconto em folha</b> como método de pagamento no checkout dos funcionários
            </label>
          </div>

          <Textarea label="Observações Internas" rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="accent-brand-main w-4 h-4" />
            Empresa Ativa no Convênio
          </label>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button type="submit" loading={saving} data-testid="save-company"><Save className="w-4 h-4" /> Salvar Empresa</Button>
            <Button type="button" variant="ghost" onClick={() => nav('/backoffice/convenio')}>Cancelar</Button>
          </div>
        </form>
      )}

      {isEdit && tab === 'funcionarios' && (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => { setForm(empty); setEmpForm({ name: '', email: '', cpf: '', phone: '', position: '', salary: 0 }); setShowEmpForm(true); setConfirmModal(null); }} data-testid="add-emp-btn">
              <Plus className="w-4 h-4" /> Novo funcionário
            </Button>
          </div>
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                <tr>
                  <th className="text-left px-3 py-2">Nome</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">CPF</th>
                  <th className="text-left px-3 py-2">Cargo</th>
                  <th className="text-right px-3 py-2">Salário</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.employee_id} className="border-t border-border hover:bg-bg-secondary/30 transition" data-testid={`emp-row-${e.employee_id}`}>
                    <td className="px-3 py-2 font-semibold">{e.name}</td>
                    <td className="px-3 py-2 text-txt-secondary">{e.email}</td>
                    <td className="px-3 py-2 text-txt-secondary font-mono">{e.cpf_digits || e.cpf || '—'}</td>
                    <td className="px-3 py-2">{e.position || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-brand-main">R$ {(e.salary || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">{e.active ? <span className="text-emerald-600 text-xs font-bold">ATIVO</span> : <span className="text-red-500 text-xs font-bold">INATIVO</span>}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => delEmployee(e.employee_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-txt-secondary">Nenhum funcionário. Adicione manualmente ou importe uma planilha.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isEdit && tab === 'import' && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="font-heading font-black text-lg mb-1">Importar funcionários em lote</h3>
            <p className="text-sm text-txt-secondary">Envie uma planilha XLSX com colunas: <b>nome, email, cpf, telefone, cargo, salario</b>. Recomendamos usar o modelo abaixo.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={downloadTemplate} data-testid="download-tpl"><Download className="w-4 h-4" /> Baixar modelo XLSX</Button>
            <label className={`inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 cursor-pointer text-sm hover:bg-bg-secondary ${importing ? 'opacity-50' : ''}`}>
              <Upload className="w-4 h-4" /> {importing ? 'Enviando...' : 'Selecionar planilha (preview)'}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => onImportFile(e.target.files?.[0], true)} data-testid="import-file" />
            </label>
          </div>

          {importPreview && (
            <div className="border border-border rounded-lg p-3 bg-bg-secondary/40">
              <div className="text-sm mb-2">Preview: <b>{importPreview.total}</b> linhas · a inserir: <b>{importPreview.preview.filter(p => p.status === 'ready').length}</b> · duplicadas: <b>{importPreview.preview.filter(p => p.status === 'duplicate').length}</b></div>
              {importPreview.errors?.length > 0 && <div className="text-xs text-red-600 mb-2">Erros: {importPreview.errors.join('; ')}</div>}
              <div className="max-h-64 overflow-y-auto bg-white border border-border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-bg-secondary sticky top-0">
                    <tr><th className="text-left px-2 py-1">Nome</th><th className="text-left px-2 py-1">Email</th><th className="text-left px-2 py-1">Cargo</th><th className="text-right px-2 py-1">Salário</th><th className="text-center px-2 py-1">Status</th></tr>
                  </thead>
                  <tbody>
                    {importPreview.preview.slice(0, 50).map((p, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1">{p.name}</td>
                        <td className="px-2 py-1">{p.email}</td>
                        <td className="px-2 py-1">{p.position}</td>
                        <td className="px-2 py-1 text-right">R$ {(p.salary || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-center">{p.status === 'ready' ? <span className="text-emerald-600 font-bold">OK</span> : <span className="text-orange-600 font-bold">DUP</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={() => onImportFile(importPreview.file, false)} loading={importing} data-testid="confirm-import">Confirmar importação</Button>
                <Button variant="ghost" onClick={() => setImportPreview(null)}>Descartar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Funcionário no Admin */}
      {showEmpForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEmpForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="font-heading font-black text-lg">Novo funcionário</h2>
              <button onClick={() => setShowEmpForm(false)} className="text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={e => addEmployee(e, false)} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <Input label="Nome completo*" required value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} />
                <Input label="Email*" type="email" required value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} hint="Cria ou vincula conta do usuário no sistema" />
                <Input label="CPF" value={empForm.cpf} onChange={e => setEmpForm({ ...empForm, cpf: e.target.value })} placeholder="000.000.000-00" />
                <Input label="Telefone" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} />
                <Input label="Cargo" value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} />
                <Input label="Salário bruto (R$)" type="number" step="0.01" value={empForm.salary} onChange={e => setEmpForm({ ...empForm, salary: e.target.value })} hint="Usado para calcular o limite do desconto em folha (30%)" />
              </div>
              <div className="p-5 border-t border-border flex gap-2 shrink-0">
                <Button type="submit" loading={submittingEmp}>Adicionar Funcionário</Button>
                <Button type="button" variant="ghost" onClick={() => setShowEmpForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Vínculo de Usuário Existente no Admin */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-border">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-black text-lg text-txt-primary">Usuário Encontrado no Sistema</h3>
                <p className="text-xs text-txt-secondary">Já existe uma conta cadastrada com estes dados</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
              <p>
                Identificamos que o usuário <strong>{confirmModal.existing_user?.name}</strong> (<strong>{confirmModal.existing_user?.email}</strong>) já possui uma conta na plataforma.
              </p>
              <p>
                Deseja <strong>vincular esta conta existente</strong> como funcionário ativo da empresa <strong>{form.name}</strong>?
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmModal(null)}>
                Cancelar
              </Button>
              <Button type="button" className="bg-amber-600 hover:bg-amber-700 text-white" loading={submittingEmp} onClick={e => addEmployee(e, true)}>
                Sim, Vincular Conta Existente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro de Usuário Responsável (Company Admin) */}
      {showRepModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-heading font-black text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> Usuário Responsável da Empresa
              </h3>
              <button onClick={() => setShowRepModal(false)} className="text-xl leading-none">&times;</button>
            </div>

            {createdRepCredentials ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-2">
                  <div className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                    ✓ Usuário Responsável Criado com Sucesso!
                  </div>
                  <p>Repasse as credenciais abaixo para o gestor/RH da empresa acessar o Painel Empresa (/empresa):</p>
                  <div className="bg-white p-3 rounded-lg border border-emerald-300 font-mono space-y-1 text-txt-primary">
                    <div><strong>E-mail:</strong> {createdRepCredentials.email}</div>
                    <div><strong>Senha inicial:</strong> {createdRepCredentials.password}</div>
                    <div><strong>Link de acesso:</strong> /login</div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setShowRepModal(false)}>Concluir</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateRepresentative} className="space-y-3">
                <Input label="Nome Completo do Gestor/RH*" required value={repForm.name} onChange={e => setRepForm({ ...repForm, name: e.target.value })} placeholder="ex: Maria Silva" />
                <Input label="Email de Acesso*" type="email" required value={repForm.email} onChange={e => setRepForm({ ...repForm, email: e.target.value })} placeholder="gestor@empresa.com" />
                <Input label="Senha Inicial*" required value={repForm.password} onChange={e => setRepForm({ ...repForm, password: e.target.value })} placeholder="123456" />
                <Input label="CPF" value={repForm.cpf} onChange={e => setRepForm({ ...repForm, cpf: e.target.value })} placeholder="000.000.000-00" />
                <Input label="Telefone / WhatsApp" value={repForm.phone} onChange={e => setRepForm({ ...repForm, phone: e.target.value })} />

                <div className="flex gap-2 justify-end pt-3 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setShowRepModal(false)}>Cancelar</Button>
                  <Button type="submit" loading={submittingRep} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Gerar Acesso Responsável
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
