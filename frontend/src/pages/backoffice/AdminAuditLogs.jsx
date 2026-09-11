import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import {
  ShieldAlert, Search, Download, Filter, Calendar,
  Loader2, Trash2, Edit, PlusCircle, Users, Activity,
  Eye, RefreshCw, X, Copy, Check
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function AdminAuditLogs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Modal de Detalhes
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 30);
      if (search) params.append('search', search);
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entity_type', entityFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await api.get(`/api/admin/audit-logs?${params.toString()}`);
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar logs de auditoria.');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, entityFilter, startDate, endDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entity_type', entityFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/audit-logs/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao exportar relatório.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_oxxpharma_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Relatório de auditoria exportado com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao exportar planilha.');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyPayload = (payload) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    toast.success('Payload copiado para a área de transferência!');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const stats = data?.stats || {
    total_all: 0,
    total_creates: 0,
    total_updates: 0,
    total_deletes: 0,
    active_admins: 0
  };

  return (
    <div data-testid="admin-audit-logs-page" className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-brand-main" /> Auditoria & Log de Operações
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Registro de todas as ações de criação, edição e exclusão realizadas pela equipe administrativa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadLogs}
            disabled={loading}
            className="gap-1.5 text-xs"
            title="Atualizar registros"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>

          <Button
            onClick={handleExport}
            loading={exporting}
            className="gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Planilha (XLSX)
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total de Operações"
          value={stats.total_all}
          sub="Ações registradas no sistema"
          color="brand"
        />
        <StatCard
          icon={Trash2}
          label="Exclusões (Risco)"
          value={stats.total_deletes}
          sub="Registros deletados"
          color="red"
        />
        <StatCard
          icon={Edit}
          label="Edições & Modificações"
          value={stats.total_updates}
          sub="Registros atualizados"
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Admins Ativos"
          value={stats.active_admins}
          sub="Usuários no rastro auditado"
          color="emerald"
        />
      </div>

      {/* Painel de Filtros */}
      <div className="bg-white border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-heading font-bold text-sm text-txt-primary flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-main" /> Filtros de Auditoria
          </div>
          {(search || actionFilter || entityFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setSearch('');
                setActionFilter('');
                setEntityFilter('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="text-xs text-red-600 hover:underline font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-txt-secondary mb-1">
              Buscar (Nome, E-mail, IP, Descrição)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-txt-secondary" />
              <input
                type="text"
                placeholder="Ex: João, prod_123, 192.168..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-txt-secondary mb-1">
              Tipo de Ação
            </label>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
            >
              <option value="">Todas as Ações</option>
              <option value="CREATE">Criação (CREATE)</option>
              <option value="UPDATE">Edição (UPDATE)</option>
              <option value="DELETE">Exclusão (DELETE)</option>
              <option value="OTHER">Outras Operações</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-txt-secondary mb-1">
              Entidade
            </label>
            <select
              value={entityFilter}
              onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 text-sm bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
            >
              <option value="">Todas as Entidades</option>
              <option value="products">Produtos</option>
              <option value="categories">Categorias</option>
              <option value="companies">Empresas Convênio</option>
              <option value="users">Usuários</option>
              <option value="orders">Pedidos</option>
              <option value="company-billings">Faturamentos</option>
              <option value="coupons">Cupons</option>
              <option value="settings">Configurações</option>
              <option value="roles">Perfis</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                De
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="w-full h-10 px-2 text-xs bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-txt-secondary mb-1">
                Até
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="w-full h-10 px-2 text-xs bg-white border border-border rounded-xl focus:outline-none focus:border-brand-main"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-txt-secondary flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-main mb-2" />
            <p className="text-sm">Carregando logs de auditoria...</p>
          </div>
        ) : !data?.items || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto text-txt-secondary/40 mb-3" />
            <h3 className="font-heading font-bold text-lg text-txt-primary">Nenhum registro de auditoria encontrado</h3>
            <p className="text-sm text-txt-secondary mt-1">Tente ajustar seus filtros de pesquisa ou alterar o intervalo de datas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-bg-secondary text-xs uppercase text-txt-secondary font-bold tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5">Data / Hora</th>
                  <th className="p-3.5">Administrador</th>
                  <th className="p-3.5">Ação</th>
                  <th className="p-3.5">Entidade</th>
                  <th className="p-3.5">Descrição da Atividade</th>
                  <th className="p-3.5">IP</th>
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map(log => (
                  <tr key={log.log_id} className="hover:bg-bg-secondary/40 transition-colors">
                    <td className="p-3.5 text-xs font-mono whitespace-nowrap text-txt-secondary">
                      {log.created_at ? log.created_at.slice(0, 19).replace('T', ' ') : '—'}
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-light text-brand-main font-black text-xs flex items-center justify-center shrink-0 uppercase">
                          {log.user_name ? log.user_name.slice(0, 2) : 'AD'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-txt-primary truncate text-xs">{log.user_name}</div>
                          <div className="text-[11px] text-txt-secondary truncate">{log.user_email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <ActionBadge action={log.action} />
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-mono bg-bg-secondary px-2.5 py-1 rounded-lg text-txt-primary border border-border">
                        {log.entity_type} {log.entity_id ? `#${log.entity_id.slice(-6)}` : ''}
                      </span>
                    </td>

                    <td className="p-3.5 font-medium text-xs text-txt-primary max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>

                    <td className="p-3.5 text-xs font-mono text-txt-secondary whitespace-nowrap">
                      {log.ip}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs h-8 px-2.5"
                        title="Ver detalhes da auditoria"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé e Paginação */}
        {data && data.total > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-bg-secondary/20 text-xs text-txt-secondary">
            <div>
              Exibindo <b>{((page - 1) * 30) + 1}</b> a <b>{Math.min(page * 30, data.total)}</b> de <b>{data.total}</b> registros
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="text-xs h-8"
              >
                Anterior
              </Button>

              <span className="font-semibold text-txt-primary px-2">
                Página {page} de {data.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage(prev => Math.min(data.pages, prev + 1))}
                className="text-xs h-8"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Log */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0 bg-bg-secondary/30">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-brand-main" />
                <div>
                  <h2 className="font-heading font-black text-lg text-txt-primary">Detalhe do Log de Auditoria</h2>
                  <p className="text-xs font-mono text-txt-secondary">{selectedLog.log_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full hover:bg-bg-secondary flex items-center justify-center text-txt-secondary hover:text-txt-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-bg-secondary/40 p-4 rounded-xl border border-border">
                <div>
                  <div className="text-xs text-txt-secondary">Data e Hora:</div>
                  <div className="font-semibold text-txt-primary font-mono mt-0.5">{selectedLog.created_at}</div>
                </div>

                <div>
                  <div className="text-xs text-txt-secondary">Endereço IP:</div>
                  <div className="font-semibold text-txt-primary font-mono mt-0.5">{selectedLog.ip}</div>
                </div>

                <div>
                  <div className="text-xs text-txt-secondary">Administrador:</div>
                  <div className="font-semibold text-txt-primary mt-0.5">{selectedLog.user_name} ({selectedLog.user_email})</div>
                </div>

                <div>
                  <div className="text-xs text-txt-secondary">Cargo / Função:</div>
                  <div className="font-semibold text-txt-primary mt-0.5 capitalize">{selectedLog.user_role}</div>
                </div>

                <div>
                  <div className="text-xs text-txt-secondary">Método & Rota HTTP:</div>
                  <div className="font-mono text-xs font-semibold text-txt-primary mt-0.5">{selectedLog.method} {selectedLog.path}</div>
                </div>

                <div>
                  <div className="text-xs text-txt-secondary">Tipo de Ação & Entidade:</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ActionBadge action={selectedLog.action} />
                    <span className="font-mono text-xs font-semibold text-txt-primary">{selectedLog.entity_type}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-txt-secondary mb-1">Descrição da Atividade:</div>
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm font-medium">
                  {selectedLog.description}
                </div>
              </div>

              <div>
                <div className="text-xs text-txt-secondary mb-1">Navegador / User Agent:</div>
                <div className="bg-bg-secondary text-txt-secondary font-mono text-xs p-2.5 rounded-lg border border-border truncate">
                  {selectedLog.user_agent || 'N/A'}
                </div>
              </div>

              {selectedLog.payload && Object.keys(selectedLog.payload).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-txt-secondary">Payload / Dados Enviados (JSON):</div>
                    <button
                      onClick={() => handleCopyPayload(selectedLog.payload)}
                      className="text-xs text-brand-main hover:underline flex items-center gap-1"
                    >
                      {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPayload ? 'Copiado!' : 'Copiar JSON'}
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-x-auto max-h-48 border border-slate-800">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end shrink-0 bg-bg-secondary/20">
              <Button onClick={() => setSelectedLog(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }) {
  const styles = {
    CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    UPDATE: 'bg-blue-100 text-blue-800 border-blue-300',
    DELETE: 'bg-red-100 text-red-800 border-red-300',
    EXECUTE: 'bg-purple-100 text-purple-800 border-purple-300',
  };
  const labels = {
    CREATE: 'Criação',
    UPDATE: 'Edição',
    DELETE: 'Exclusão',
    EXECUTE: 'Execução',
  };

  const style = styles[action] || 'bg-slate-100 text-slate-800 border-slate-300';
  const label = labels[action] || action;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${style}`}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colorStyles = {
    brand: 'bg-brand-light text-brand-main border-brand-main/20',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${colorStyles[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-heading font-black text-txt-primary">{value || 0}</div>
        <div className="text-xs font-semibold text-txt-primary leading-tight">{label}</div>
        <div className="text-[11px] text-txt-secondary mt-0.5">{sub}</div>
      </div>
    </div>
  );
}
