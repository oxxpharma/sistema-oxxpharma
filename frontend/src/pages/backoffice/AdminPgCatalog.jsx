import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Layers,
  Search,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Save,
  Key,
  ShieldCheck,
  Package,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPgCatalog() {
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'config' | 'agency'
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState({
    host: '127.0.0.1',
    port: 5432,
    database: 'oxxpharma_catalog',
    user: 'oxx_backend',
    password: '',
    agency_user: 'ads_agency',
    agency_password: 'AgenciaOxxAds#2026',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showAgencyPassword, setShowAgencyPassword] = useState(false);

  // Produtos no PostgreSQL
  const [products, setProducts] = useState([]);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodPage, setProdPage] = useState(1);
  const [prodPages, setProdPages] = useState(1);
  const [prodSearch, setProdSearch] = useState('');
  const [prodLoading, setProdLoading] = useState(false);

  // Estados de ação
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Modal de detalhes do produto
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Carrega status e config
  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/postgres/status');
      setStatus(res);
    } catch (e) {
      console.error('Erro ao carregar status:', e);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/postgres/config');
      if (res) {
        setConfig(prev => ({
          ...prev,
          host: res.host || '127.0.0.1',
          port: res.port || 5432,
          database: res.database || 'oxxpharma_catalog',
          user: res.user || 'oxx_backend',
          password: '',
          agency_user: res.agency_user || 'ads_agency',
          agency_password: res.agency_password || 'AgenciaOxxAds#2026',
        }));
      }
    } catch (e) {
      console.error('Erro ao carregar config:', e);
    }
  }, []);

  const loadProducts = useCallback(async (page = 1, search = prodSearch) => {
    setProdLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '15');
      if (search && search.trim()) params.append('search', search.trim());

      const res = await api.get(`/api/admin/postgres/products?${params.toString()}`);
      setProducts(res.items || []);
      setProdTotal(res.total || 0);
      setProdPage(res.page || 1);
      setProdPages(res.pages || 1);
    } catch (e) {
      console.error('Erro ao carregar produtos do PG:', e);
    } finally {
      setProdLoading(false);
    }
  }, [prodSearch]);

  useEffect(() => {
    loadStatus();
    loadConfig();
    loadProducts(1);
  }, [loadStatus, loadConfig, loadProducts]);

  // Testar conexão
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/api/admin/postgres/test-connection', config);
      setTestResult(res);
      if (res?.success) {
        toast.success(res.message || 'Conexão com PostgreSQL bem-sucedida!');
      } else {
        toast.error(res?.error || 'Falha ao conectar ao PostgreSQL');
      }
    } catch (e) {
      const errMsg = e?.message || 'Erro ao testar conexão';
      setTestResult({ success: false, error: errMsg });
      toast.error(errMsg);
    } finally {
      setTesting(false);
      loadStatus();
    }
  };

  // Salvar configurações
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/api/admin/postgres/config', config);
      if (res?.success) {
        toast.success('Configurações salvas e conexão atualizada!');
        if (res.test) setTestResult(res.test);
        await loadStatus();
        await loadProducts(1);
      } else {
        toast.error(res?.error || 'Erro ao salvar configurações');
      }
    } catch (e) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // Sincronizar catálogo
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/api/admin/postgres/sync');
      if (res?.success) {
        toast.success(res.message || `${res.synced} produtos sincronizados com sucesso no PostgreSQL!`);
        await loadStatus();
        await loadProducts(1);
      } else {
        toast.error(res?.error || 'Erro ao sincronizar');
      }
    } catch (e) {
      toast.error(e?.message || 'Erro durante a sincronização');
    } finally {
      setSyncing(false);
    }
  };

  // Copiar texto para o clipboard
  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copiado para a área de transferência!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isConnected = status?.pg_connected === true;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-heading flex items-center gap-2">
                Catálogo PostgreSQL
                <Badge variant={isConnected ? 'success' : 'danger'}>
                  {isConnected ? 'ONLINE' : 'DESCONECTADO'}
                </Badge>
              </h1>
              <p className="text-xs text-txt-secondary">
                Banco dedicado para Meta Ads, Google Shopping, TikTok Ads e parceiros de tráfego.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadStatus();
              loadProducts(prodPage);
            }}
            disabled={syncing || prodLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${prodLoading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>

          <Button
            size="sm"
            onClick={handleSyncNow}
            disabled={syncing}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {syncing ? 'Sincronizando...' : 'Sincronizar Tudo Agora'}
          </Button>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Status da Conexão */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-txt-secondary mb-1">
            <span>Status PostgreSQL</span>
            {isConnected ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
          </div>
          <div className="text-lg font-bold text-gray-900">
            {isConnected ? 'Conectado' : 'Sem Conexão'}
          </div>
          <p className="text-[11px] text-txt-secondary truncate mt-1">
            {status?.pg_version || (isConnected ? 'PostgreSQL Ativo' : 'Verifique as credenciais')}
          </p>
        </div>

        {/* Produtos no PostgreSQL */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-txt-secondary mb-1">
            <span>Produtos no Catálogo</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-bold text-indigo-600">
            {status?.pg_count ?? 0}
          </div>
          <p className="text-[11px] text-txt-secondary mt-1">
            tabela <code className="text-gray-700 font-mono">products_catalog</code>
          </p>
        </div>

        {/* Produtos na Loja (MongoDB) */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-txt-secondary mb-1">
            <span>Total na Loja (MongoDB)</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-gray-900">
            {status?.mongo_count ?? 0}
          </div>
          <p className="text-[11px] text-txt-secondary mt-1">
            {status?.in_sync ? (
              <span className="text-emerald-600 font-medium">✓ 100% Sincronizado</span>
            ) : (
              <span className="text-amber-600 font-medium">⚠ Sincronização Pendente</span>
            )}
          </p>
        </div>

        {/* Última Sincronização */}
        <div className="bg-white p-5 rounded-2xl border border-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-txt-secondary mb-1">
            <span>Última Sincronização</span>
            <Server className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-sm font-bold text-gray-900 truncate">
            {status?.last_sync?.at ? formatDateTime(status.last_sync.at) : 'Ainda não executado'}
          </div>
          <p className="text-[11px] text-txt-secondary mt-1">
            {status?.last_sync ? `${status.last_sync.synced} itens sincronizados` : 'Clique em Sincronizar Tudo'}
          </p>
        </div>
      </div>

      {/* ALERTA DE ERRO SE HOUVER */}
      {!isConnected && status?.error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-sm">Falha de conexão com o PostgreSQL</p>
            <p className="font-mono">{status.error}</p>
            <p className="text-rose-700 pt-1">
              Verifique a senha informada na aba <b>Configuração da Conexão</b> abaixo ou certifique-se de que o cluster está ouvindo na porta 5432.
            </p>
          </div>
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex border-b border-border gap-2 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'products'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-txt-secondary hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Produtos & Fotos Sincronizadas ({prodTotal})
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'config'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-txt-secondary hover:text-gray-900'
          }`}
        >
          <Key className="w-4 h-4" />
          Configuração da Conexão
        </button>

        <button
          onClick={() => setActiveTab('agency')}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'agency'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-txt-secondary hover:text-gray-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Acesso da Agência de Anúncios
        </button>
      </div>

      {/* ABA 1: PRODUTOS NO POSTGRESQL */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* BARRA DE BUSCA */}
          <div className="bg-white p-4 rounded-2xl border border-border flex items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, SKU, EAN ou ID no PostgreSQL..."
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadProducts(1);
                }}
                className="w-full pl-10 pr-9 py-2 text-xs bg-bg-secondary/60 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
              {prodSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setProdSearch('');
                    loadProducts(1, '');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadProducts(1)}
              className="gap-1.5"
            >
              <Search className="w-3.5 h-3.5" /> Filtrar
            </Button>
          </div>

          {/* TABELA DE PRODUTOS */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-border">
                  <tr>
                    <th className="p-3 w-14 text-center">Foto</th>
                    <th className="p-3">Produto / Identificação</th>
                    <th className="p-3">SKU / EAN</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Preço</th>
                    <th className="p-3 text-center">Estoque</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {prodLoading && products.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        Carregando produtos do PostgreSQL...
                      </td>
                    </tr>
                  )}
                  {!prodLoading && products.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        Nenhum produto encontrado no PostgreSQL.
                        <div className="mt-2">
                          <Button size="sm" onClick={handleSyncNow} className="gap-2 bg-indigo-600 text-white">
                            <Database className="w-4 h-4" /> Sincronizar Produtos Agora
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {products.map((p) => {
                    const price = Number(p.effective_price || p.price || 0);
                    const oldPrice = p.discount_price && Number(p.discount_price) < Number(p.price) ? Number(p.price) : null;
                    const images = Array.isArray(p.all_images) ? p.all_images : [];

                    return (
                      <tr key={p.product_id} className="hover:bg-slate-50/70 transition-colors">
                        {/* FOTO PRINCIPAL */}
                        <td className="p-3 text-center">
                          {p.main_image ? (
                            <img
                              src={p.main_image}
                              alt={p.name}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 mx-auto"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* NOME E URL */}
                        <td className="p-3 max-w-[260px]">
                          <div className="font-semibold text-gray-900 truncate" title={p.name}>
                            {p.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5 truncate">
                            <span>ID: {p.product_id}</span>
                            {p.product_url && (
                              <a
                                href={p.product_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline flex items-center gap-0.5 ml-1"
                              >
                                Ver link <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        {/* SKU / EAN */}
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          <div>SKU: {p.sku || '-'}</div>
                          {p.ean_gtin && <div className="text-[10px] text-slate-400">EAN: {p.ean_gtin}</div>}
                        </td>

                        {/* CATEGORIA */}
                        <td className="p-3 text-slate-600">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                            {p.category || 'Geral'}
                          </span>
                        </td>

                        {/* PREÇO */}
                        <td className="p-3 text-right font-semibold">
                          <div className="text-gray-900">{formatCurrency(price)}</div>
                          {oldPrice && (
                            <div className="text-[10px] text-slate-400 line-through">
                              {formatCurrency(oldPrice)}
                            </div>
                          )}
                        </td>

                        {/* ESTOQUE */}
                        <td className="p-3 text-center">
                          <span className={`font-mono font-bold ${p.stock > 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                            {p.stock}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {p.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        {/* AÇÕES */}
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedProduct(p)}
                            className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                            title="Ver fotos e payload JSON completo"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Dados & Fotos ({images.length})
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            {prodPages > 1 && (
              <div className="p-3 border-t border-border flex items-center justify-between bg-slate-50 text-xs text-slate-600">
                <span>Total: <b>{prodTotal}</b> produtos cadastrados no PostgreSQL</span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={prodPage <= 1 || prodLoading}
                    onClick={() => loadProducts(prodPage - 1)}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </Button>
                  <span className="px-2 font-mono">
                    {prodPage} / {prodPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={prodPage >= prodPages || prodLoading}
                    onClick={() => loadProducts(prodPage + 1)}
                    className="h-7 px-2"
                  >
                    Próxima <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: CONFIGURAÇÕES DE CONEXÃO */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-border shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-base text-gray-900 font-heading">
                Credenciais de Conexão do PostgreSQL
              </h3>
              <p className="text-xs text-txt-secondary">
                Configure os dados do usuário com permissão de escrita para que a OxxPharma sincronize automaticamente o catálogo.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Host / Servidor
                  </label>
                  <input
                    type="text"
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    placeholder="127.0.0.1 ou oxxpharma.com.br"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-border rounded-xl font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Use 127.0.0.1 se estiver no mesmo servidor Ubuntu.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Porta
                  </label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => setConfig({ ...config, port: e.target.value })}
                    placeholder="5432"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-border rounded-xl font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Nome do Banco de Dados
                  </label>
                  <input
                    type="text"
                    value={config.database}
                    onChange={(e) => setConfig({ ...config, database: e.target.value })}
                    placeholder="oxxpharma_catalog"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-border rounded-xl font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Usuário Backend (Escrita/Sync)
                  </label>
                  <input
                    type="text"
                    value={config.user}
                    onChange={(e) => setConfig({ ...config, user: e.target.value })}
                    placeholder="oxx_backend"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-border rounded-xl font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Senha do Usuário {config.user}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    placeholder="Digite a nova senha configurada no PostgreSQL..."
                    className="w-full pl-3 pr-10 py-2 text-sm bg-slate-50 border border-border rounded-xl font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Coloque aqui a senha exata que você definiu para o usuário no banco PostgreSQL.
                </span>
              </div>

              {/* RESULTADO DO TESTE */}
              {testResult && (
                <div className={`p-4 rounded-xl text-xs border ${
                  testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold mb-0.5">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                    {testResult.success ? 'Teste de Conexão Bem-Sucedido!' : 'Erro no Teste de Conexão'}
                  </div>
                  <p className="font-mono text-[11px]">{testResult.version || testResult.error || testResult.message}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || saving}
                  className="gap-2"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Testar Conexão
                </Button>

                <Button
                  type="submit"
                  disabled={saving || testing}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Configurações
                </Button>
              </div>
            </form>
          </div>

          {/* DICAS E AJUDA */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 text-xs text-slate-700">
            <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-600" /> Informações do Servidor
            </h4>
            <p>
              Ao alterar a senha do usuário <code className="font-mono text-indigo-700 font-bold">{config.user}</code> no PostgreSQL, basta inseri-la aqui e clicar em <b>Salvar Configurações</b>.
            </p>
            <div className="p-3 rounded-lg bg-white border border-slate-200 font-mono text-[11px] space-y-1">
              <p className="text-slate-500"># Para redefinir a senha via terminal SSH:</p>
              <p className="text-indigo-800">sudo -u postgres psql -c "ALTER USER oxx_backend WITH PASSWORD 'NovaSenhaAqui';"</p>
            </div>
            <p className="text-slate-500">
              O sistema atualiza a conexão instantaneamente sem precisar reiniciar serviços manuais.
            </p>
          </div>
        </div>
      )}

      {/* ABA 3: ACESSO DA AGÊNCIA DE ANÚNCIOS */}
      {activeTab === 'agency' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-border shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-base text-gray-900 font-heading flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Credenciais para a Empresa de Anúncios / Tráfego
              </h3>
              <p className="text-xs text-txt-secondary">
                Entregue estas credenciais para a equipe responsável pelas campanhas (Meta Ads, Google Shopping, TikTok). Este usuário tem permissão <b>estritamente de leitura (SELECT ONLY)</b>, sem qualquer risco de alterar dados da loja.
              </p>
            </div>

            {/* CARD PRONTO PARA COPIAR */}
            <div className="p-5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs space-y-3 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  Dados de Conexão PostgreSQL (Somente Leitura)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const text = `DADOS DE ACESSO AO CATÁLOGO POSTGRESQL (OxxPharma):
Host: oxxpharma.com.br
Porta: 5432
Banco de Dados: ${config.database}
Usuário: ${config.agency_user}
Senha: ${config.agency_password}
Tabela: products_catalog

Fotos e Imagens:
- Coluna main_image: URL direta da foto principal em alta resolução
- Coluna all_images: Array JSON com todas as fotos adicionais da galeria
- Coluna product_url: Link da página do produto`;
                    copyText(text, 'all_creds');
                  }}
                  className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 h-7"
                >
                  {copiedKey === 'all_creds' ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedKey === 'all_creds' ? 'Copiado!' : 'Copiar Tudo'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">HOST / SERVIDOR:</span>
                  <span className="text-white font-bold text-sm">oxxpharma.com.br</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PORTA:</span>
                  <span className="text-white font-bold text-sm">5432</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">BANCO DE DADOS:</span>
                  <span className="text-emerald-400 font-bold text-sm">{config.database}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">TABELA DE PRODUTOS:</span>
                  <span className="text-emerald-400 font-bold text-sm">products_catalog</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">USUÁRIO:</span>
                  <span className="text-sky-300 font-bold text-sm">{config.agency_user}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SENHA:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sky-300 font-bold text-sm">
                      {showAgencyPassword ? config.agency_password : '••••••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAgencyPassword(!showAgencyPassword)}
                      className="text-slate-400 hover:text-white"
                    >
                      {showAgencyPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(config.agency_password, 'agency_pwd')}
                      className="text-slate-400 hover:text-white"
                      title="Copiar senha"
                    >
                      {copiedKey === 'agency_pwd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="text-amber-300 font-semibold block mb-0.5">Fotos e Criativos de Anúncios:</span>
                • <code className="text-emerald-300">main_image</code>: URL pública da foto de capa pronta para anúncios.<br />
                • <code className="text-emerald-300">all_images</code>: Array JSON com todas as fotos complementares.<br />
                • <code className="text-emerald-300">product_url</code>: Link para redirecionamento da campanha direto para o produto.
              </div>
            </div>

            {/* DICAS DE INTEGRAÇÃO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-xs text-gray-900 block">DBeaver / DataGrip</span>
                <p className="text-[11px] text-slate-600">
                  Para visualizar a tabela via cliente SQL, basta criar uma conexão padrão PostgreSQL com o Host e credenciais acima.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-xs text-gray-900 block">Python / Pandas / ETL</span>
                <p className="text-[11px] text-slate-600">
                  Compatível com <code className="font-mono">psycopg2</code>, <code className="font-mono">SQLAlchemy</code> ou <code className="font-mono">asyncpg</code> para scripts automatizados de campanhas.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-xs text-gray-900 block">PowerBI / Looker Studio</span>
                <p className="text-[11px] text-slate-600">
                  Conector nativo PostgreSQL para geração de relatórios de catálogo e monitoramento de estoque.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO PRODUTO (JSON E FOTOS) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-border bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-gray-900 truncate max-w-lg">
                  {selectedProduct.name}
                </h3>
                <span className="text-[11px] font-mono text-slate-500">ID: {selectedProduct.product_id}</span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* GALERIA DE FOTOS */}
              <div>
                <span className="text-xs font-bold text-gray-900 block mb-2">
                  Fotos Sincronizadas no PostgreSQL ({Array.isArray(selectedProduct.all_images) ? selectedProduct.all_images.length : 0})
                </span>
                {Array.isArray(selectedProduct.all_images) && selectedProduct.all_images.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {selectedProduct.all_images.map((imgUrl, i) => (
                      <div key={i} className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 aspect-square">
                        <img
                          src={imgUrl}
                          alt={`Foto ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <a
                          href={imgUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-medium"
                        >
                          Abrir URL <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Nenhuma foto cadastrada para este produto.</p>
                )}
              </div>

              {/* JSON COMPLETO DO REGISTRO */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-900">
                    Registro Completo na tabela <code className="font-mono text-indigo-600">products_catalog</code>:
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(JSON.stringify(selectedProduct, null, 2), 'prod_json')}
                    className="h-7 text-xs"
                  >
                    {copiedKey === 'prod_json' ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedKey === 'prod_json' ? 'Copiado!' : 'Copiar JSON'}
                  </Button>
                </div>
                <pre className="font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto leading-relaxed max-h-64">
                  {JSON.stringify(selectedProduct, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-border bg-slate-50 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedProduct(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
