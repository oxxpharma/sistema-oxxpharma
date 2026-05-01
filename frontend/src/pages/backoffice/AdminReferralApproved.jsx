import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_URL } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Loader2, UserCheck, Download, FileSpreadsheet, FileText, Eye, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminReferralApproved() {
  const [batches, setBatches] = useState([]);
  const [totalApproved, setTotalApproved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState(null);
  const [dayRows, setDayRows] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/referral-approved/batches');
      setBatches(r.batches || []);
      setTotalApproved(r.total_approved || 0);
    } catch (e) { toast.error(e?.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openBatch = async (day) => {
    if (openDay === day) { setOpenDay(null); setDayRows([]); return; }
    setOpenDay(day);
    setLoadingDay(true);
    try {
      const r = await api.get(`/api/admin/referral-approved/list?start=${day}&end=${day}`);
      setDayRows(r.approvals || []);
    } catch (e) { toast.error(e?.message); }
    finally { setLoadingDay(false); }
  };

  const download = (format, start, end) => {
    const token = localStorage.getItem('token');
    const qs = new URLSearchParams();
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    const url = `${API_URL}/api/admin/referral-approved/export.${format}?${qs.toString()}`;
    // Browser precisa do token no header; usamos fetch e baixa via blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) { toast.error('Falha no download'); return; }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const suffix = start ? `-${start}${end && end !== start ? '_' + end : ''}` : '-todos';
        a.download = `programa-beneficios-aprovados${suffix}.${format}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => toast.error(e?.message));
  };

  return (
    <div data-testid="admin-referral-approved">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-black text-2xl text-txt-primary flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-main" /> Aprovados no Programa de Benefícios
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Exporte os dados de cadastro dos afiliados aprovados. Cada lote = dia de aprovação (para conciliação com operações externas como o cartão de benefícios).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => download('csv')} data-testid="dl-all-csv"><FileText className="w-4 h-4" /> Baixar tudo (CSV)</Button>
          <Button variant="outline" size="sm" onClick={() => download('xlsx')} data-testid="dl-all-xlsx"><FileSpreadsheet className="w-4 h-4" /> Baixar tudo (XLSX)</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total de aprovados" value={totalApproved} icon={Users} />
        <KpiCard label="Dias com aprovações" value={batches.length} icon={UserCheck} />
        <KpiCard label="Último lote" value={batches[0]?.date || '-'} hint={batches[0] ? `${batches[0].count} aprovados` : ''} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-main" /></div>
      ) : batches.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-10 text-center text-sm text-txt-secondary">
          Nenhum afiliado aprovado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map(b => (
            <div key={b.date} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-bg-secondary/30">
                <button onClick={() => openBatch(b.date)} className="flex-1 flex items-center gap-3 text-left" data-testid={`batch-${b.date}`}>
                  <div className="w-11 h-11 rounded-lg bg-brand-light text-brand-main flex items-center justify-center font-heading font-black text-lg shrink-0">
                    {b.count}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-txt-primary">{formatDateBR(b.date)}</div>
                    <div className="text-xs text-txt-secondary truncate">
                      {b.sample_names.slice(0, 3).join(', ')}{b.count > 3 ? ` e mais ${b.count - 3}...` : ''}
                    </div>
                  </div>
                  <Eye className={`w-4 h-4 text-txt-secondary transition ${openDay === b.date ? 'rotate-90' : ''}`} />
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => download('csv', b.date, b.date)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs bg-bg-secondary hover:bg-border rounded"
                    data-testid={`dl-csv-${b.date}`}
                    title="Baixar CSV deste dia"
                  ><FileText className="w-3 h-3" /> CSV</button>
                  <button
                    onClick={() => download('xlsx', b.date, b.date)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs bg-brand-main text-white hover:bg-brand-hover rounded"
                    data-testid={`dl-xlsx-${b.date}`}
                    title="Baixar XLSX deste dia"
                  ><FileSpreadsheet className="w-3 h-3" /> XLSX</button>
                </div>
              </div>
              {openDay === b.date && (
                <div className="border-t border-border bg-bg-secondary/30">
                  {loadingDay ? (
                    <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-brand-main inline" /></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white text-xs uppercase text-txt-secondary border-b border-border">
                          <tr>
                            <th className="text-left p-3">Código</th>
                            <th className="text-left p-3">Nome</th>
                            <th className="text-left p-3">E-mail</th>
                            <th className="text-left p-3">Telefone</th>
                            <th className="text-left p-3">CPF</th>
                            <th className="text-left p-3">Aprovado em</th>
                            <th className="text-right p-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayRows.map(r => (
                            <tr key={r.user_id} className="border-t border-border bg-white/80">
                              <td className="p-3 font-mono text-xs">{r.referral_code}</td>
                              <td className="p-3 font-semibold">{r.name}</td>
                              <td className="p-3 text-xs">{r.email}</td>
                              <td className="p-3 text-xs">{r.phone}</td>
                              <td className="p-3 font-mono text-xs">{r.cpf}</td>
                              <td className="p-3 text-xs text-txt-secondary">{r.approved_at ? formatDateTime(r.approved_at) : '-'}</td>
                              <td className="p-3 text-right">
                                <Link to={`/backoffice/usuarios/${r.user_id}`} className="text-xs text-brand-main hover:underline">Ver perfil →</Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4 text-brand-main" />}
        <div className="text-xs font-semibold text-txt-secondary uppercase tracking-wide">{label}</div>
      </div>
      <div className="text-2xl font-heading font-black text-txt-primary">{value}</div>
      {hint && <div className="text-xs text-txt-secondary mt-1">{hint}</div>}
    </div>
  );
}

function formatDateBR(dateStr) {
  if (!dateStr || dateStr === 'sem-data') return 'Sem data';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch { return dateStr; }
}
