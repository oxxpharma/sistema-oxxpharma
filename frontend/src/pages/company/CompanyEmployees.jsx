import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Trash2, Upload, Download, Loader2, Search, Edit, UserCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const emptyEmp = { name: '', email: '', cpf: '', registration_number: '', matricula: '', phone: '', position: '', salary: 0, payroll_limit_override: '', active: true };

export default function CompanyEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEmp);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const r = await api.get(`/api/company/employees${q}`);
      setEmployees(r.employees || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openNew = () => { setEditing(null); setForm(emptyEmp); setShowForm(true); setConfirmModal(null); };
  const openEdit = (e) => { setEditing(e.employee_id); setForm({ ...emptyEmp, ...e }); setShowForm(true); setConfirmModal(null); };

  const submit = async (e, confirmLink = false) => {
    e?.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        salary: parseFloat(form.salary) || 0,
        payroll_limit_override: form.payroll_limit_override === '' || form.payroll_limit_override === null ? null : parseFloat(form.payroll_limit_override),
      };

      if (editing) {
        await api.put(`/api/company/employees/${editing}`, payload);
        toast.success('Funcionário atualizado com sucesso!');
        setShowForm(false);
        load();
      } else {
        const url = `/api/company/employees${confirmLink ? '?confirm_link=true' : ''}`;
        const res = await api.post(url, payload);

        if (res.needs_confirmation) {
          setConfirmModal(res);
          return;
        }

        if (res.user_linked) {
          toast.success(`Conta de usuário existente (${res.email}) vinculada como funcionário!`);
        } else {
          toast.success('Novo funcionário cadastrado e conta de usuário criada no sistema!');
        }
        setShowForm(false);
        setConfirmModal(null);
        load();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Excluir funcionário?')) return;
    try {
      await api.del(`/api/company/employees/${id}`);
      toast.success('Removido');
      load();
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
    } catch { toast.error('Falha ao baixar modelo'); }
  };

  const onImportFile = async (file, dryRun = true) => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/company/employees/import-xlsx?dry_run=${dryRun}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro no import');
      if (dryRun) setImportPreview({ ...data, file });
      else {
        toast.success(`Importado: ${data.inserted}, ignorado: ${data.skipped}`);
        setImportPreview(null);
        await load();
      }
    } catch (err) { toast.error(err.message); }
    finally { setImporting(false); }
  };

  return (
    <div data-testid="company-employees">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="font-heading font-black text-3xl">Funcionários</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4" /> Modelo XLSX</Button>
          <label className={`inline-flex items-center gap-2 border border-border bg-white rounded-lg px-3 py-2 cursor-pointer text-sm hover:bg-bg-secondary ${importing ? 'opacity-50' : ''}`}>
            <Upload className="w-4 h-4" /> {importing ? 'Importando...' : 'Importar XLSX'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => onImportFile(e.target.files?.[0], true)} />
          </label>
          <Button onClick={openNew} data-testid="new-emp"><Plus className="w-4 h-4" /> Novo Funcionário</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-3 mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-secondary" />
          <input className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm" placeholder="Buscar nome, email, CPF..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <Button variant="outline" onClick={load}>Buscar</Button>
      </div>

      {importPreview && (
        <div className="bg-white border border-border rounded-xl p-4 mb-4">
          <div className="text-sm mb-2">Preview: <b>{importPreview.total}</b> · a inserir: <b>{importPreview.preview.filter(p => p.status === 'ready').length}</b> · duplicadas: <b>{importPreview.preview.filter(p => p.status === 'duplicate').length}</b></div>
          <div className="flex gap-2">
            <Button onClick={() => onImportFile(importPreview.file, false)} loading={importing}>Confirmar importação</Button>
            <Button variant="ghost" onClick={() => setImportPreview(null)}>Descartar</Button>
          </div>
        </div>
      )}

      {loading ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div> : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
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
                <tr key={e.employee_id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{e.name}</td>
                  <td className="px-3 py-2 text-txt-secondary">{e.email}</td>
                  <td className="px-3 py-2 text-txt-secondary font-mono">{e.cpf || e.cpf_digits || '—'}</td>
                  <td className="px-3 py-2">{e.position || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-brand-main">R$ {(e.salary || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">{e.active ? <span className="text-emerald-600 text-xs font-bold">ATIVO</span> : <span className="text-red-500 text-xs font-bold">INATIVO</span>}</td>
                  <td className="px-3 py-2 flex gap-1 justify-end">
                    <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-bg-secondary rounded"><Edit className="w-4 h-4 text-txt-secondary" /></button>
                    <button onClick={() => del(e.employee_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-txt-secondary">Nenhum funcionário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Formulário de Funcionário */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="font-heading font-black text-lg">{editing ? 'Editar funcionário' : 'Novo funcionário'}</h2>
              <button onClick={() => setShowForm(false)} className="text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={e => submit(e, false)} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <Input label="Nome completo*" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input label="Email*" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} hint="Gera ou vincula a conta no sistema com este e-mail" />
                <Input label="CPF" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
                <Input label="Matrícula Funcional" value={form.registration_number || form.matricula || ''} onChange={e => setForm({ ...form, registration_number: e.target.value, matricula: e.target.value })} placeholder="Ex: 10492" hint="Nº de identificação funcional no RH (usado no termo de aceite)" />
                <Input label="Telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <Input label="Cargo" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                <Input label="Salário bruto (R$)" type="number" step="0.01" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} hint="Margem consignável mensal será 30% deste valor" />
                <Input label="Limite consignado manual (R$)" type="number" step="0.01" value={form.payroll_limit_override || ''} onChange={e => setForm({ ...form, payroll_limit_override: e.target.value })} placeholder="Deixe vazio para usar 30% do salário" hint="Override manual opcional" />
                <label className="flex items-center gap-2 text-sm pt-1"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Funcionário ativo</label>
              </div>
              <div className="p-5 border-t border-border flex gap-2 shrink-0">
                <Button type="submit" loading={submitting}>Salvar Funcionário</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Vínculo de Usuário Existente */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-border">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-black text-lg text-txt-primary">Usuário Encontrado no Sistema</h3>
                <p className="text-xs text-txt-secondary">Já existe um usuário cadastrado com estes dados</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
              <p>
                Identificamos que o usuário <strong>{confirmModal.existing_user?.name}</strong> (<strong>{confirmModal.existing_user?.email}</strong>) já possui uma conta cadastrada na plataforma.
              </p>
              <p>
                Deseja <strong>vincular esta conta existente</strong> como funcionário ativo e aplicar as condições do convênio?
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmModal(null)}>
                Cancelar
              </Button>
              <Button type="button" className="bg-amber-600 hover:bg-amber-700 text-white" loading={submitting} onClick={e => submit(e, true)}>
                Sim, Vincular Conta Existente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
