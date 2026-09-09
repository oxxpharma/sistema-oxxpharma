import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Trash2, Upload, Download, Loader2, Search, Edit } from 'lucide-react';
import { toast } from 'sonner';

const emptyEmp = { name: '', email: '', cpf: '', phone: '', position: '', salary: 0, active: true };

export default function CompanyEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEmp);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);

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

  const openNew = () => { setEditing(null); setForm(emptyEmp); setShowForm(true); };
  const openEdit = (e) => { setEditing(e.employee_id); setForm({ ...emptyEmp, ...e }); setShowForm(true); };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, salary: parseFloat(form.salary) || 0 };
      if (editing) await api.put(`/api/company/employees/${editing}`, payload);
      else await api.post('/api/company/employees', payload);
      toast.success('Salvo');
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.message); }
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
          <Button onClick={openNew} data-testid="new-emp"><Plus className="w-4 h-4" /> Novo</Button>
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
                  <td className="px-3 py-2">{e.position || '—'}</td>
                  <td className="px-3 py-2 text-right">R$ {(e.salary || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">{e.active ? <span className="text-emerald-600 text-xs font-bold">ATIVO</span> : <span className="text-red-500 text-xs font-bold">INATIVO</span>}</td>
                  <td className="px-3 py-2 flex gap-1 justify-end">
                    <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-bg-secondary rounded"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => del(e.employee_id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-txt-secondary">Nenhum funcionário.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="font-heading font-black text-lg">{editing ? 'Editar funcionário' : 'Novo funcionário'}</h2>
              <button onClick={() => setShowForm(false)} className="text-xl leading-none">×</button>
            </div>
            <form onSubmit={submit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <Input label="Nome*" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input label="Email*" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input label="CPF" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
                <Input label="Telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <Input label="Cargo" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                <Input label="Salário bruto (R$)" type="number" step="0.01" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativo</label>
              </div>
              <div className="p-5 border-t border-border flex gap-2 shrink-0">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
