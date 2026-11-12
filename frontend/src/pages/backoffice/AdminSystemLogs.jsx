import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import {
  Terminal, RefreshCw, Trash2, Copy, Check, AlertTriangle,
  Info, ChevronDown, ChevronRight, Server, Clock, Search, Code2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function AdminSystemLogs() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ errors: [], file_logs: [], total_errors: 0, system_info: {} });
  const [activeTab, setActiveTab] = useState('errors'); // 'errors' | 'files' | 'ssh_guide'
  const [search, setSearch] = useState('');
  const [expandedError, setExpandedError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/system-logs?limit=50');
      setData(res || { errors: [], file_logs: [], total_errors: 0, system_info: {} });
    } catch (err) {
      toast.error('Erro ao buscar logs do servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleClear = async () => {
    if (!window.confirm('Tem certeza de que deseja limpar o histórico de erros do sistema?')) return;
    setClearing(true);
    try {
      await api.delete('/api/admin/system-logs');
      toast.success('Logs de erros limpos com sucesso!');
      fetchLogs();
    } catch (err) {
      toast.error('Falha ao limpar logs: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  const filteredErrors = (data.errors || []).filter(err => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (err.path || '').toLowerCase().includes(q) ||
      (err.error || '').toLowerCase().includes(q) ||
      (err.error_type || '').toLowerCase().includes(q) ||
      (err.user_email || '').toLowerCase().includes(q) ||
      (err.user_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="admin-system-logs-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 text-brand-main rounded-xl">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl text-txt-primary">Logs do Servidor & Diagnóstico</h1>
              <p className="text-xs text-txt-secondary mt-0.5">
                Monitoramento de exceções, erros em tempo real e visualizador de logs do backend.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {data.errors?.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={clearing}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Erros
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'errors'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Erros Registrados ({data.errors?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'files'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          <Server className="w-4 h-4" />
          Arquivos de Log (Linux)
        </button>

        <button
          onClick={() => setActiveTab('ssh_guide')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'ssh_guide'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          <Code2 className="w-4 h-4" />
          Como acessar via SSH
        </button>
      </div>

      {/* Tab: Erros Registrados */}
      {activeTab === 'errors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-secondary" />
              <input
                type="text"
                placeholder="Filtrar por rota (/checkout), tipo de erro, e-mail..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-border rounded-xl focus:outline-hidden focus:border-brand-main"
              />
            </div>
            <span className="text-xs text-txt-secondary">
              Exibindo {filteredErrors.length} de {data.errors?.length || 0} erros
            </span>
          </div>

          {filteredErrors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg text-txt-primary">Nenhum erro registrado</h3>
              <p className="text-sm text-txt-secondary max-w-md mx-auto">
                O backend não registrou nenhum erro não tratado recentemente. O sistema está operando normalmente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredErrors.map(err => {
                const isExpanded = expandedError === err.error_id;
                return (
                  <div
                    key={err.error_id}
                    className="bg-white rounded-xl border border-rose-200/80 hover:border-rose-300 transition overflow-hidden shadow-2xs"
                  >
                    <div
                      className="p-4 flex items-start justify-between gap-4 cursor-pointer select-none"
                      onClick={() => setExpandedError(isExpanded ? null : err.error_id)}
                    >
                      <div className="flex items-start gap-3">
                        <button type="button" className="mt-0.5 text-txt-secondary">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs font-black rounded-md">
                              {err.method || 'POST'} {err.path || err.source || '/api'}
                            </span>
                            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                              {err.error_type || 'Exception'}
                            </span>
                            <span className="text-xs text-txt-secondary flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(err.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>

                          <div className="font-mono text-sm font-semibold text-rose-950 mt-1.5 break-all">
                            {err.error || 'Erro sem mensagem'}
                          </div>

                          {(err.user_email || err.user_id) && (
                            <div className="text-xs text-txt-secondary mt-1">
                              Usuário: <span className="font-medium text-txt-primary">{err.user_email || err.user_id}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(err.error_id, err.traceback || err.error);
                          }}
                          className="h-8 px-2.5 text-xs text-txt-secondary hover:text-txt-primary"
                        >
                          {copiedId === err.error_id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span className="ml-1 hidden sm:inline">Copiar Trace</span>
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-950 p-4 border-t border-rose-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-400 font-mono">Stack Traceback Completo:</span>
                          <button
                            onClick={() => handleCopy(err.error_id, err.traceback)}
                            className="text-xs text-slate-300 hover:text-white flex items-center gap-1 font-mono"
                          >
                            <Copy className="w-3 h-3" /> Copiar tudo
                          </button>
                        </div>
                        <pre className="font-mono text-xs text-rose-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-96">
                          {err.traceback || 'Traceback não disponível.'}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Arquivos de Log */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            <div>
              Exibindo as últimas 100 linhas dos arquivos de log gerados pelo serviço Supervisor em <code>/var/log/oxxpharma/</code>.
            </div>
          </div>

          {(data.file_logs || []).map((file, idx) => (
            <div key={idx} className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-xs">
                <span className="font-mono text-slate-300 font-semibold">{file.file}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] ${file.exists ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                  {file.exists ? 'Disponível' : 'Arquivo ainda não gerado'}
                </span>
              </div>
              <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                {file.lines || file.error || 'Nenhuma linha registrada no momento.'}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Guia SSH */}
      {activeTab === 'ssh_guide' && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-6">
          <div>
            <h2 className="font-heading font-black text-lg text-txt-primary">Como acessar os logs do servidor via SSH</h2>
            <p className="text-sm text-txt-secondary mt-1">
              Caso você ou seu sysadmin queiram acompanhar os logs em tempo real pelo terminal, siga os passos abaixo:
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="font-bold text-sm text-txt-primary flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-brand-main flex items-center justify-center text-xs">1</span>
                Conectar ao servidor via terminal (PowerShell, CMD ou terminal Linux/Mac):
              </div>
              <div className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-xs flex justify-between items-center">
                <code>ssh root@oxxpharma.com.br</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('ssh_cmd', 'ssh root@oxxpharma.com.br')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-sm text-txt-primary flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-brand-main flex items-center justify-center text-xs">2</span>
                Acompanhar os logs de erro em tempo real:
              </div>
              <div className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-xs flex justify-between items-center">
                <code>sudo supervisorctl tail -f oxxpharma-backend stderr</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('tail_cmd', 'sudo supervisorctl tail -f oxxpharma-backend stderr')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-sm text-txt-primary flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-brand-main flex items-center justify-center text-xs">3</span>
                Ver as últimas 100 linhas do arquivo de erro:
              </div>
              <div className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-xs flex justify-between items-center">
                <code>sudo tail -n 100 /var/log/oxxpharma/backend.err.log</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('cat_cmd', 'sudo tail -n 100 /var/log/oxxpharma/backend.err.log')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-sm text-txt-primary flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-brand-main flex items-center justify-center text-xs">4</span>
                Reiniciar o backend caso necessário:
              </div>
              <div className="bg-slate-950 text-slate-100 p-3 rounded-xl font-mono text-xs flex justify-between items-center">
                <code>sudo supervisorctl restart oxxpharma-backend</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy('restart_cmd', 'sudo supervisorctl restart oxxpharma-backend')}
                  className="text-slate-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
