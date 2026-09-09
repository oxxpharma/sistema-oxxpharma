import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { ArrowLeft, Save, Loader2, Trash2, Plus, Upload, Download, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

const empty = {
  name: '', cnpj: '', email: '', contact_name: '', contact_phone: '',
  discount_percent: 0, payroll_enabled: false, payroll_limit_percent: 35,
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
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [tab, setTab] = useState('dados');

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

  const addEmployee = async (e) => {
    e?.preventDefault();
    try {
      const payload = { ...empForm, salary: parseFloat(empForm.salary) || 0 };
      await api.post(`/api/company/employees?company_id=${companyId}`, payload);
      toast.success('Funcionário adicionado');
      setShowEmpForm(false);
      setEmpForm({ name: '', email: '', cpf: '', phone: '', position: '', salary: 0 });
      await loadEmployees();
    } catch (err) { toast.error(err.message); }
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
          {[['dados', 'Dados'], ['funcionarios', `Funcionários (${employees.length})`], ['import', 'Importar XLSX']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 ${tab === k ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary'}`} data-testid={`tab-${k}`}>{l}</button>
          ))}
        </div>
      )}

      {(!isEdit || tab === 'dados') && (
        <form onSubmit={save} className="space-y-4 bg-white border border-border rounded-xl p-5">
          <div className="grid md:grid-cols-2 gap-3">
            <Input label="Nome*" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="company-name" />
            <Input label="CNPJ*" required value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} data-testid="company-cnpj" />
            <Input label="Email para relatórios*" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} hint="Recebe o fechamento mensal" />
            <Input label="Responsável (RH)" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            <Input label="Telefone" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
            <Input label="URL do contrato PDF" value={form.contract_url} onChange={e => setForm({ ...form, contract_url: e.target.value })} placeholder="https://..." />
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-bold text-txt-secondary uppercase mb-2">Regras comerciais</div>
            <div className="grid md:grid-cols-3 gap-3">
              <Input label="Desconto para funcionários (%)" type="number" step="0.01" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} hint="0-100" />
              <Input label="Limite consignado (%)" type="number" step="0.01" value={form.payroll_limit_percent} onChange={e => setForm({ ...form, payroll_limit_percent: e.target.value })} hint="Máx 35% (lei)" />
              <Input label="Comissão da empresa (%)" type="number" step="0.01" value={form.commission_company_percent} onChange={e => setForm({ ...form, commission_company_percent: e.target.value })} hint="Deduzida do propagandista" />
            </div>
            <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={form.payroll_enabled} onChange={e => setForm({ ...form, payroll_enabled: e.target.checked })} data-testid="payroll-enabled" /> Habilitar <b>Desconto em folha</b> como método de pagamento</label>
          </div>

          <Textarea label="Observações" rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Empresa ativa</label>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button type="submit" loading={saving} data-testid="save-company"><Save className="w-4 h-4" /> Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => nav('/backoffice/convenio')}>Cancelar</Button>
          </div>
        </form>
      )}

      {isEdit && tab === 'funcionarios' && (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowEmpForm(true)} data-testid="add-emp-btn"><Plus className="w-4 h-4" /> Novo funcionário</Button>
          </div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
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
                  <tr key={e.employee_id} className="border-t border-border" data-testid={`emp-row-${e.employee_id}`}>
                    <td className="px-3 py-2 font-semibold">{e.name}</td>
                    <td className="px-3 py-2 text-txt-secondary">{e.email}</td>
                    <td className="px-3 py-2 text-txt-secondary">{e.cpf_digits || e.cpf || '—'}</td>
                    <td className="px-3 py-2">{e.position || '—'}</td>
                    <td className="px-3 py-2 text-right">R$ {(e.salary || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">{e.active ? <span className="text-emerald-600 text-xs font-bold">ATIVO</span> : <span className="text-red-500 text-xs font-bold">INATIVO</span>}</td>
                    <td className="px-3 py-2">
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
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
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

      {showEmpForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEmpForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="font-heading font-black text-lg">Novo funcionário</h2>
              <button onClick={() => setShowEmpForm(false)} className="text-xl leading-none">×</button>
            </div>
            <form onSubmit={addEmployee} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <Input label="Nome*" required value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} />
                <Input label="Email*" type="email" required value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
                <Input label="CPF" value={empForm.cpf} onChange={e => setEmpForm({ ...empForm, cpf: e.target.value })} />
                <Input label="Telefone" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} />
                <Input label="Cargo" value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} />
                <Input label="Salário bruto (R$)" type="number" step="0.01" value={empForm.salary} onChange={e => setEmpForm({ ...empForm, salary: e.target.value })} hint="Usado para calcular limite de desconto em folha" />
              </div>
              <div className="p-5 border-t border-border flex gap-2 shrink-0">
                <Button type="submit">Adicionar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowEmpForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
