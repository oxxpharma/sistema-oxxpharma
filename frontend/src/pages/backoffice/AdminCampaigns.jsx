import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Send,
  Play,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  RotateCcw,
  Clock,
  Sparkles,
  Mail,
  Search,
  Loader2,
  X,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../../components/admin/Pagination';

export default function AdminCampaigns() {
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'logs'
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ total_campaigns: 0, active_campaigns: 0, total_emails_sent: 0 });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsCampFilter, setLogsCampFilter] = useState('all');

  // Modal de edição / criação
  const [showModal, setShowModal] = useState(false);
  const [editingCamp, setEditingCamp] = useState(null);
  const [savingCamp, setSavingCamp] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'consumption_time',
    days_offset: 5,
    active: true,
    subject: '',
    headline: '',
    body_text: '',
    cta_text: 'Acessar Loja',
    coupon_code: '',
  });

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/admin/campaigns');
      setCampaigns(data.campaigns || []);
      setStats(data.stats || {});
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(logsPage),
        limit: '25',
      });
      if (logsCampFilter !== 'all') params.append('campaign_id', logsCampFilter);
      if (logsSearch.trim()) params.append('search', logsSearch.trim());

      const data = await api.get(`/api/admin/campaigns/logs?${params.toString()}`);
      setLogs(data.logs || []);
      setLogsTotalPages(data.pages || 1);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar logs de disparos');
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, logsCampFilter, logsSearch]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, loadLogs]);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await api.post('/api/admin/campaigns/run', {});
      toast.success(res.message || 'Verificação e disparos concluídos com sucesso!');
      loadCampaigns();
      if (activeTab === 'logs') loadLogs();
    } catch (err) {
      toast.error(err.message || 'Erro ao executar campanhas');
    } finally {
      setRunning(false);
    }
  };

  const toggleCampaignActive = async (camp) => {
    try {
      await api.put(`/api/admin/campaigns/${camp.campaign_id}`, {
        active: !camp.active,
      });
      toast.success(camp.active ? 'Campanha pausada' : 'Campanha ativada');
      loadCampaigns();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar campanha');
    }
  };

  const openNewModal = () => {
    setEditingCamp(null);
    setForm({
      name: '',
      type: 'consumption_time',
      days_offset: 5,
      active: true,
      subject: '{customer_name}, hora de repor seu {product_name} 🌿',
      headline: 'Mantenha sua rotina de cuidados em dia',
      body_text: 'Olá, {customer_name}!\n\nNotamos que seu produto deve estar acabando. Para não interromper seu tratamento, garanta sua reposição com facilidade.',
      cta_text: 'Repor Produto Agora',
      coupon_code: '',
    });
    setShowModal(true);
  };

  const openEditModal = (camp) => {
    setEditingCamp(camp);
    setForm({
      name: camp.name || '',
      type: camp.type || 'consumption_time',
      days_offset: camp.days_offset || 5,
      active: !!camp.active,
      subject: camp.subject || '',
      headline: camp.headline || '',
      body_text: camp.body_text || '',
      cta_text: camp.cta_text || 'Acessar Loja',
      coupon_code: camp.coupon_code || '',
    });
    setShowModal(true);
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Informe o nome da campanha');
      return;
    }
    setSavingCamp(true);
    try {
      if (editingCamp) {
        await api.put(`/api/admin/campaigns/${editingCamp.campaign_id}`, form);
        toast.success('Campanha atualizada com sucesso');
      } else {
        await api.post('/api/admin/campaigns', form);
        toast.success('Campanha criada com sucesso');
      }
      setShowModal(false);
      loadCampaigns();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar campanha');
    } finally {
      setSavingCamp(false);
    }
  };

  const handleDeleteCampaign = async (camp) => {
    if (!window.confirm(`Tem certeza que deseja excluir a campanha "${camp.name}"?`)) return;
    try {
      await api.delete(`/api/admin/campaigns/${camp.campaign_id}`);
      toast.success('Campanha excluída');
      loadCampaigns();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir campanha');
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'consumption_time':
        return 'Tempo de Consumo';
      case 'days_after_purchase':
        return 'Pós-compra (Dias)';
      case 'inactive_customer':
        return 'Cliente Inativo';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 pb-16" data-testid="admin-campaigns-page">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary flex items-center gap-2.5">
            <Send className="w-7 h-7 text-brand-main" />
            Campanhas de Recompra & Pós-Venda
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Automação de emails por tempo de consumo dos produtos, avaliação após 15 dias e reativação de clientes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={handleRunNow}
            loading={running}
            className="gap-2 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            data-testid="run-campaigns-btn"
          >
            <Play className="w-4 h-4 fill-white" /> Executar Verificação Agora
          </Button>

          <Button onClick={openNewModal} className="gap-2" data-testid="new-campaign-btn">
            <Plus className="w-4 h-4" /> Nova Campanha
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-border bg-white shadow-xs">
          <div className="text-xs uppercase font-bold text-txt-secondary tracking-wider mb-1">
            Campanhas Ativas
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {stats.active_campaigns} <span className="text-xs text-txt-secondary font-normal">de {stats.total_campaigns}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-white shadow-xs">
          <div className="text-xs uppercase font-bold text-txt-secondary tracking-wider mb-1">
            Total de Emails Enviados
          </div>
          <div className="text-2xl font-black text-brand-main">
            {stats.total_emails_sent}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-white shadow-xs">
          <div className="text-xs uppercase font-bold text-txt-secondary tracking-wider mb-1">
            Tentativas de Disparo
          </div>
          <div className="text-2xl font-black text-gray-800">
            {stats.total_attempts}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-white shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-bold text-txt-secondary tracking-wider mb-1">
              Status do Motor
            </div>
            <div className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Operacional
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadCampaigns} className="p-2 text-gray-400 hover:text-gray-600">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'campaigns'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          Campanhas Configuradas ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'logs'
              ? 'border-brand-main text-brand-main'
              : 'border-transparent text-txt-secondary hover:text-txt-primary'
          }`}
        >
          Histórico de Disparos (Logs)
        </button>
      </div>

      {/* CONTEÚDO TAB 1: CAMPANHAS */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-border">
              <Loader2 className="w-8 h-8 animate-spin text-brand-main mx-auto mb-2" />
              <p className="text-sm text-txt-secondary">Carregando campanhas...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-border">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-lg text-txt-primary">Nenhuma campanha configurada</h3>
              <p className="text-sm text-txt-secondary mt-1 mb-4">Crie sua primeira campanha para começar os disparos automáticos.</p>
              <Button onClick={openNewModal} className="gap-2">
                <Plus className="w-4 h-4" /> Criar Campanha
              </Button>
            </div>
          ) : (
            campaigns.map((camp) => (
              <div
                key={camp.campaign_id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition ${
                  camp.active ? 'border-border hover:border-brand-main/40' : 'border-gray-200 bg-gray-50/50 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-lg text-txt-primary">{camp.name}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {getTypeLabel(camp.type)}
                      </span>
                      {camp.active ? (
                        <Badge variant="success">Ativa</Badge>
                      ) : (
                        <Badge variant="error">Pausada</Badge>
                      )}
                      {camp.coupon_code && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Tag className="w-3 h-3" /> Cupom: {camp.coupon_code}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-txt-secondary flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Gatilho:{' '}
                        {camp.type === 'consumption_time' && (
                          <strong className="text-txt-primary">{camp.days_offset} dias antes do término estimado do frasco</strong>
                        )}
                        {camp.type === 'days_after_purchase' && (
                          <strong className="text-txt-primary">{camp.days_offset} dias após a compra confirmada</strong>
                        )}
                        {camp.type === 'inactive_customer' && (
                          <strong className="text-txt-primary">{camp.days_offset} dias sem realizar novos pedidos</strong>
                        )}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                      <div>
                        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Assunto:</span>{' '}
                        <span className="font-medium text-gray-900">{camp.subject}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Título Interno:</span>{' '}
                        <span className="text-gray-800">{camp.headline}</span>
                      </div>
                      <div className="line-clamp-2 text-gray-600 italic">
                        "{camp.body_text}"
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-txt-secondary pt-1">
                      <span>Total disparados: <strong className="text-txt-primary">{camp.stats?.sent_count || 0}</strong></span>
                      {camp.stats?.last_run && (
                        <span>Último disparo: <strong className="text-txt-primary">{formatDate(camp.stats.last_run)}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleCampaignActive(camp)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        camp.active
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {camp.active ? 'Pausar' : 'Ativar'}
                    </button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(camp)}
                      className="text-xs h-8 px-2.5 gap-1"
                      title="Editar Campanha"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCampaign(camp)}
                      className="text-xs h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                      title="Excluir Campanha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CONTEÚDO TAB 2: LOGS / HISTÓRICO */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-border p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logsSearch}
                onChange={(e) => { setLogsSearch(e.target.value); setLogsPage(1); }}
                placeholder="Buscar por cliente, email, produto ou assunto..."
                className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={logsCampFilter}
                onChange={(e) => { setLogsCampFilter(e.target.value); setLogsPage(1); }}
                className="px-3 py-2 border border-border rounded-xl text-xs bg-white focus:outline-hidden"
              >
                <option value="all">Todas as Campanhas</option>
                {campaigns.map(c => (
                  <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>
                ))}
              </select>

              <Button size="sm" variant="outline" onClick={loadLogs} className="gap-1.5 text-xs">
                <RotateCcw className="w-3.5 h-3.5" /> Atualizar
              </Button>
            </div>
          </div>

          {logsLoading ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-border">
              <Loader2 className="w-8 h-8 animate-spin text-brand-main mx-auto mb-2" />
              <p className="text-sm text-txt-secondary">Carregando histórico de envios...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-border">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-lg text-txt-primary">Nenhum envio registrado</h3>
              <p className="text-sm text-txt-secondary mt-1">
                Quando os critérios das campanhas forem atendidos e emails forem disparados, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-border text-txt-secondary uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3.5 font-bold">Data/Hora</th>
                      <th className="p-3.5 font-bold">Campanha</th>
                      <th className="p-3.5 font-bold">Cliente</th>
                      <th className="p-3.5 font-bold">Produto / Assunto</th>
                      <th className="p-3.5 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-gray-50/60 transition">
                        <td className="p-3.5 text-gray-600 whitespace-nowrap">
                          {formatDate(log.sent_at)}
                        </td>
                        <td className="p-3.5 font-semibold text-txt-primary">
                          {log.campaign_name || log.campaign_id}
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-gray-900">{log.customer_name || 'Cliente'}</div>
                          <div className="text-gray-500 font-mono text-[11px]">{log.customer_email}</div>
                        </td>
                        <td className="p-3.5 max-w-xs">
                          {log.product_name && (
                            <div className="font-bold text-brand-main truncate">{log.product_name}</div>
                          )}
                          <div className="text-gray-600 truncate text-[11px]">{log.subject}</div>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          {log.status === 'sent' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 font-semibold bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200" title={log.reason || 'Falha no envio'}>
                              <AlertCircle className="w-3.5 h-3.5" /> Falhou ({log.reason || 'Erro'})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-border">
                <Pagination page={logsPage} pages={logsTotalPages} onPageChange={setLogsPage} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE CAMPANHA */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
              <h2 className="font-heading font-black text-xl text-txt-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-main" />
                {editingCamp ? 'Editar Campanha' : 'Nova Campanha'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Nome da Campanha*
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Reposição Programada Dr. Bactéria"
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Tipo de Gatilho
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden bg-white"
                  >
                    <option value="consumption_time">Tempo de Consumo do Produto</option>
                    <option value="days_after_purchase">Dias após a Compra</option>
                    <option value="inactive_customer">Cliente Inativo (Sem compras)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    {form.type === 'consumption_time' && 'Dias antes do frasco acabar'}
                    {form.type === 'days_after_purchase' && 'Dias após o pedido'}
                    {form.type === 'inactive_customer' && 'Dias sem novas compras'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={form.days_offset}
                    onChange={(e) => setForm({ ...form, days_offset: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Assunto do Email*
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ex: {customer_name}, hora de repor seu {product_name}!"
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Variáveis disponíveis: <code className="bg-gray-100 px-1 py-0.5 rounded">{"{customer_name}"}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">{"{product_name}"}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">{"{store_name}"}</code>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Título em Destaque no Topo do Email
                </label>
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="Ex: Não interrompa seu tratamento e seus resultados"
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                  Corpo da Mensagem (Texto do Email)*
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.body_text}
                  onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                  placeholder="Escreva a mensagem..."
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Texto do Botão (CTA)
                  </label>
                  <input
                    type="text"
                    value={form.cta_text}
                    onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                    placeholder="Ex: Garantir Meu Próximo Frasco"
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Cupom de Desconto (Opcional)
                  </label>
                  <input
                    type="text"
                    value={form.coupon_code}
                    onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                    placeholder="Ex: VOLTEI10 ou REPOSICAO15"
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main uppercase font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="camp-active"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-main"
                />
                <label htmlFor="camp-active" className="text-sm font-semibold text-txt-primary cursor-pointer">
                  Manter campanha ativa (disparos habilitados)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={savingCamp}>
                  Salvar Campanha
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
