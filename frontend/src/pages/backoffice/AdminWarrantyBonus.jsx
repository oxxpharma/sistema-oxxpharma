import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Upload, Download, Loader2, Search, Award } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminWarrantyBonus() {
  const [cfg, setCfg] = useState({ enabled: true, amount_per_unit: 100, min_order_per_unit: 300 });
  const [items, setItems] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('bonuses');

  const load = async () => {
    setLoading(true);
    try {
      const [c, list, ups] = await Promise.all([
        api.get('/api/admin/warranty-bonus/config'),
        api.get(`/api/admin/warranty-bonus/list${search ? `?cpf=${search}` : ''}`),
        api.get('/api/admin/warranty-bonus/uploads'),
      ]);
      setCfg(c);
      setItems(list.items || []);
      setUploads(ups.uploads || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const saveCfg = async () => {
    try {
      await api.put('/api/admin/warranty-bonus/config', {
        enabled: cfg.enabled,
        amount_per_unit: parseFloat(cfg.amount_per_unit) || 0,
        min_order_per_unit: parseFloat(cfg.min_order_per_unit) || 0,
      });
      toast.success('Config salva');
    } catch (err) { toast.error(err.message); }
  };

  const downloadTpl = async () => {
    const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/warranty-bonus/template.xlsx`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo_bonus_garantia.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const doUpload = async (file, dryRun = true) => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/warranty-bonus/upload?dry_run=${dryRun}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro');
      if (dryRun) setPreview({ ...data, file });
      else {
        toast.success(`Inseridos: ${data.inserted}, duplicados: ${data.duplicates}, vinculados: ${data.linked_immediately}`);
        setPreview(null);
        load();
      }
    } catch (err) { toast.error(err.message); }
    finally { setImporting(false); }
  };

  return (
    <div data-testid="admin-warranty-bonus">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-6 h-6 text-brand-main" />
        <h1 className="font-heading font-black text-3xl">Bônus de Garantia (Ozoxx)</h1>
      </div>
      <p className="text-sm text-txt-secondary mb-6">Clientes que registram aparelhos ganham bônus em compras futuras.</p>

      <div className="bg-white border border-border rounded-xl p-5 mb-4">
        <h2 className="font-bold mb-3">Configuração global</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Bônus por aparelho (R$)" type="number" step="0.01" value={cfg.amount_per_unit} onChange={e => setCfg({ ...cfg, amount_per_unit: e.target.value })} />
          <Input label="Compra mínima por unidade (R$)" type="number" step="0.01" value={cfg.min_order_per_unit} onChange={e => setCfg({ ...cfg, min_order_per_unit: e.target.value })} />
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} /> Sistema ativo</label>
          </div>
        </div>
        <Button className="mt-3" onClick={saveCfg}>Salvar config</Button>
      </div>

      <div className="bg-white border border-border rounded-xl p-5 mb-4">
        <h2 className="font-bold mb-3">Importar planilha</h2>
        <p className="text-xs text-txt-secondary mb-3">Colunas: <b>nome, cpf, serie</b>. Cada linha = 1 aparelho = 1 unidade de bônus.</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadTpl}><Download className="w-4 h-4" /> Modelo XLSX</Button>
          <label className="inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 cursor-pointer text-sm hover:bg-bg-secondary">
            <Upload className="w-4 h-4" /> {importing ? 'Processando...' : 'Enviar planilha (preview)'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => doUpload(e.target.files?.[0], true)} />
          </label>
        </div>
        {preview && (
          <div className="mt-3 border border-border rounded-lg p-3 bg-bg-secondary/40">
            <div className="text-sm mb-2">Preview: <b>{preview.total}</b> · a inserir: <b>{preview.preview.filter(p => p.status === 'new').length}</b> · duplicadas: <b>{preview.preview.filter(p => p.status === 'duplicate').length}</b></div>
            <div className="flex gap-2">
              <Button onClick={() => doUpload(preview.file, false)}>Confirmar</Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-border mb-3">
        {[['bonuses', 'Bônus'], ['uploads', 'Uploads']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === k ? 'border-brand-main text-brand-main' : 'border-transparent text-txt-secondary'}`}>{l}</button>
        ))}
      </div>

      {tab === 'bonuses' && (
        <div>
          <div className="bg-white rounded-xl border border-border p-3 mb-3 flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-secondary" />
              <input className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm" placeholder="Buscar por CPF..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
            </div>
            <Button variant="outline" onClick={load}>Buscar</Button>
          </div>
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-main" /> : (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
                  <tr><th className="text-left px-3 py-2">Nome</th><th className="text-left px-3 py-2">CPF</th><th className="text-left px-3 py-2">Série</th><th className="text-center px-3 py-2">Status</th><th className="text-left px-3 py-2">User vinculado</th></tr>
                </thead>
                <tbody>
                  {items.map(b => (
                    <tr key={b.bonus_id} className="border-t border-border">
                      <td className="px-3 py-2">{b.name}</td>
                      <td className="px-3 py-2">{b.cpf_digits}</td>
                      <td className="px-3 py-2">{b.serial}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          b.status === 'used' ? 'bg-gray-200 text-gray-700' :
                          b.status === 'claimed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-orange-100 text-orange-700'}`}>{b.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">{b.user_id || '—'}</td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-txt-secondary">Nenhum bônus.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'uploads' && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary">
              <tr><th className="text-left px-3 py-2">Arquivo</th><th className="text-right px-3 py-2">Inseridos</th><th className="text-right px-3 py-2">Vinculados</th><th className="text-right px-3 py-2">Duplicados</th><th className="text-left px-3 py-2">Data</th></tr>
            </thead>
            <tbody>
              {uploads.map(u => (
                <tr key={u.upload_id} className="border-t border-border">
                  <td className="px-3 py-2">{u.filename}</td>
                  <td className="px-3 py-2 text-right">{u.inserted}</td>
                  <td className="px-3 py-2 text-right">{u.linked_immediately}</td>
                  <td className="px-3 py-2 text-right">{u.duplicates}</td>
                  <td className="px-3 py-2 text-xs">{u.created_at?.slice(0, 19).replace('T', ' ')}</td>
                </tr>
              ))}
              {uploads.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-txt-secondary">Nenhum upload.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
