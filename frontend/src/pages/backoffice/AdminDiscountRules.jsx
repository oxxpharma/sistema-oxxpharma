import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  Percent, Plus, Pencil, Trash2, Copy, Search, X, AlertCircle,
  Sparkles, Users, MapPin, Package, Clock, CreditCard, Tag,
  ChevronRight, Calendar, DollarSign, Layers, Check, Ban, Eye
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

const BRAZIL_REGIONS_DEF = [
  { id: 'sul', name: 'Sul', states: ['PR', 'SC', 'RS'], color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'sudeste', name: 'Sudeste', states: ['SP', 'RJ', 'MG', 'ES'], color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'centro_oeste', name: 'Centro-Oeste', states: ['MS', 'MT', 'GO', 'DF'], color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'nordeste', name: 'Nordeste', states: ['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI'], color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'norte', name: 'Norte', states: ['AM', 'PA', 'RO', 'TO', 'AC', 'AP', 'RR'], color: 'bg-teal-50 text-teal-700 border-teal-200' },
];

const ALL_UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const EMPTY_RULE = {
  name: '',
  description: '',
  badge_text: '',
  active: true,
  priority: 0,
  discount_type: 'percent',
  discount_value: 10,
  max_discount: '',
  target_audience: 'all', // 'all', 'specific_users', 'user_categories'
  target_user_ids: [],
  target_user_emails: [],
  target_user_categories: [],
  employee_criteria: 'all', // 'all', 'only_employees', 'exclude_employees'
  only_first_purchase: false,
  target_regions: [],
  target_states: [],
  product_scope: 'all', // 'all', 'categories', 'subcategories', 'products'
  applicable_categories: [],
  applicable_subcategories: [],
  applicable_products: [],
  excluded_products: [],
  exclude_on_sale: false,
  min_subtotal: 0,
  max_subtotal: '',
  min_quantity: '',
  payment_methods: [], // vazio = todos
  valid_from: '',
  valid_until: '',
  usage_limit: '',
  per_user_limit: '',
  allow_cumulative_coupon: true,
};

export default function AdminDiscountRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'audience', 'products', 'conditions'

  // Catálogos auxiliares
  const [userCats, setUserCats] = useState([]);
  const [prodCats, setProdCats] = useState([]);
  const [prodSubs, setProdSubs] = useState([]);
  const [products, setProducts] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Estados de busca interna nos seletores
  const [searchUser, setSearchUser] = useState('');
  const [searchProd, setSearchProd] = useState('');
  const [searchExcluded, setSearchExcluded] = useState('');

  // Filtros da listagem principal
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'inactive'
  const [filterAudience, setFilterAudience] = useState('all');

  const [form, setForm] = useState(EMPTY_RULE);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, uCatsRes, pCatsRes, pSubsRes, prodsRes, usersRes] = await Promise.all([
        api.get('/api/admin/discount-rules'),
        api.get('/api/admin/user-categories').catch(() => ({ categories: [] })),
        api.get('/api/admin/categories').catch(() => api.get('/api/categories')).catch(() => ({ categories: [] })),
        api.get('/api/admin/subcategories').catch(() => ({ subcategories: [] })),
        api.get('/api/admin/products?limit=1000').catch(() => api.get('/api/products?limit=1000')).catch(() => ({ products: [] })),
        api.get('/api/admin/users?limit=300').catch(() => ({ users: [] })),
      ]);
      setRules(rRes.rules || []);
      setUserCats(uCatsRes.categories || []);
      setProdCats(pCatsRes.categories || []);
      setProdSubs(pSubsRes.subcategories || []);
      setProducts(prodsRes.products || []);
      setUsersList(usersRes.users || []);
    } catch (err) {
      toast.error('Erro ao carregar regras de desconto: ' + (err.message || 'Erro inesperado'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_RULE);
    setActiveTab('general');
    setSearchUser('');
    setSearchProd('');
    setSearchExcluded('');
    setOpen(true);
  };

  const openEdit = (rule) => {
    setEditingId(rule.rule_id);
    setForm({
      ...EMPTY_RULE,
      ...rule,
      max_discount: rule.max_discount ?? '',
      max_subtotal: rule.max_subtotal ?? '',
      min_quantity: rule.min_quantity ?? '',
      usage_limit: rule.usage_limit ?? '',
      per_user_limit: rule.per_user_limit ?? '',
      valid_from: rule.valid_from ? rule.valid_from.slice(0, 10) : '',
      valid_until: rule.valid_until ? rule.valid_until.slice(0, 10) : '',
      target_user_ids: Array.isArray(rule.target_user_ids) ? rule.target_user_ids : [],
      target_user_emails: Array.isArray(rule.target_user_emails) ? rule.target_user_emails : [],
      target_user_categories: Array.isArray(rule.target_user_categories) ? rule.target_user_categories : [],
      target_regions: Array.isArray(rule.target_regions) ? rule.target_regions : [],
      target_states: Array.isArray(rule.target_states) ? rule.target_states : [],
      applicable_categories: Array.isArray(rule.applicable_categories) ? rule.applicable_categories : [],
      applicable_subcategories: Array.isArray(rule.applicable_subcategories) ? rule.applicable_subcategories : [],
      applicable_products: Array.isArray(rule.applicable_products) ? rule.applicable_products : [],
      excluded_products: Array.isArray(rule.excluded_products) ? rule.excluded_products : [],
      payment_methods: Array.isArray(rule.payment_methods) ? rule.payment_methods : [],
    });
    setActiveTab('general');
    setSearchUser('');
    setSearchProd('');
    setSearchExcluded('');
    setOpen(true);
  };

  const duplicateRule = (rule) => {
    setEditingId(null);
    setForm({
      ...EMPTY_RULE,
      ...rule,
      name: `${rule.name} (Cópia)`,
      badge_text: rule.badge_text ? `${rule.badge_text} (Cópia)` : '',
      times_used: 0,
      total_discount_given: 0,
      max_discount: rule.max_discount ?? '',
      max_subtotal: rule.max_subtotal ?? '',
      min_quantity: rule.min_quantity ?? '',
      usage_limit: rule.usage_limit ?? '',
      per_user_limit: rule.per_user_limit ?? '',
      valid_from: rule.valid_from ? rule.valid_from.slice(0, 10) : '',
      valid_until: rule.valid_until ? rule.valid_until.slice(0, 10) : '',
    });
    setActiveTab('general');
    setOpen(true);
    toast.info('Regra duplicada. Ajuste as informações e salve.');
  };

  const handleToggle = async (ruleId) => {
    try {
      const res = await api.patch(`/api/admin/discount-rules/${ruleId}/toggle`);
      setRules((prev) => prev.map((r) => (r.rule_id === ruleId ? res : r)));
      toast.success(`Regra ${res.active ? 'ativada' : 'desativada'} com sucesso!`);
    } catch (err) {
      toast.error('Erro ao alternar status: ' + (err.message || 'Erro'));
    }
  };

  const handleDelete = async (ruleId, name) => {
    if (!window.confirm(`Tem certeza que deseja excluir a regra "${name}"?`)) return;
    try {
      await api.delete(`/api/admin/discount-rules/${ruleId}`);
      setRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
      toast.success('Regra excluída com sucesso.');
    } catch (err) {
      toast.error('Erro ao excluir: ' + (err.message || 'Erro'));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Informe o nome da regra de desconto');
      return;
    }
    if (form.discount_value <= 0) {
      toast.error('O valor do desconto deve ser maior que zero');
      return;
    }
    if (form.discount_type === 'percent' && form.discount_value > 100) {
      toast.error('O percentual de desconto não pode ser maior que 100%');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        discount_value: Number(form.discount_value),
        max_discount: form.max_discount === '' ? null : Number(form.max_discount),
        min_subtotal: Number(form.min_subtotal || 0),
        max_subtotal: form.max_subtotal === '' ? null : Number(form.max_subtotal),
        min_quantity: form.min_quantity === '' ? null : parseInt(form.min_quantity, 10),
        usage_limit: form.usage_limit === '' ? null : parseInt(form.usage_limit, 10),
        per_user_limit: form.per_user_limit === '' ? null : parseInt(form.per_user_limit, 10),
        priority: parseInt(form.priority || 0, 10),
      };

      if (editingId) {
        const updated = await api.put(`/api/admin/discount-rules/${editingId}`, payload);
        setRules((prev) => prev.map((r) => (r.rule_id === editingId ? updated : r)));
        toast.success('Regra atualizada com sucesso!');
      } else {
        const created = await api.post('/api/admin/discount-rules', payload);
        setRules((prev) => [created, ...prev]);
        toast.success('Regra criada com sucesso!');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar regra');
    } finally {
      setSaving(false);
    }
  };

  // Helpers de seleção de chips / listas
  const toggleArrayItem = (field, val) => {
    const cur = new Set(form[field] || []);
    if (cur.has(val)) cur.delete(val);
    else cur.add(val);
    setForm({ ...form, [field]: [...cur] });
  };

  const toggleRegion = (regionId) => {
    const cur = new Set(form.target_regions || []);
    if (cur.has(regionId)) cur.delete(regionId);
    else cur.add(regionId);
    setForm({ ...form, target_regions: [...cur] });
  };

  const toggleState = (uf) => {
    const cur = new Set(form.target_states || []);
    if (cur.has(uf)) cur.delete(uf);
    else cur.add(uf);
    setForm({ ...form, target_states: [...cur] });
  };

  const addExcludedProduct = (pid) => {
    if (!form.excluded_products.includes(pid)) {
      setForm({ ...form, excluded_products: [...form.excluded_products, pid] });
    }
  };

  const removeExcludedProduct = (pid) => {
    setForm({
      ...form,
      excluded_products: form.excluded_products.filter((id) => id !== pid),
    });
  };

  const addTargetUser = (u) => {
    const ids = new Set(form.target_user_ids || []);
    ids.add(u.user_id);
    const emails = new Set(form.target_user_emails || []);
    if (u.email) emails.add(u.email);
    setForm({
      ...form,
      target_user_ids: [...ids],
      target_user_emails: [...emails],
    });
  };

  const removeTargetUser = (userId) => {
    const u = usersList.find((usr) => usr.user_id === userId);
    setForm({
      ...form,
      target_user_ids: (form.target_user_ids || []).filter((id) => id !== userId),
      target_user_emails: (form.target_user_emails || []).filter((em) => em !== u?.email),
    });
  };

  // Dicionários para renderização rápida
  const prodsMap = useMemo(() => {
    const m = {};
    for (const p of products) m[p.product_id] = p;
    return m;
  }, [products]);

  const userCatsMap = useMemo(() => {
    const m = {};
    for (const c of userCats) m[c.category_id] = c;
    return m;
  }, [userCats]);

  // Filtro da tabela principal
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (filterStatus === 'active' && !r.active) return false;
      if (filterStatus === 'inactive' && r.active) return false;
      if (filterAudience === 'employees' && r.employee_criteria !== 'only_employees') return false;
      if (filterAudience === 'first_purchase' && !r.only_first_purchase) return false;
      if (filterAudience === 'regions' && (!r.target_regions?.length && !r.target_states?.length)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.name || '').toLowerCase().includes(q);
        const matchDesc = (r.description || '').toLowerCase().includes(q);
        const matchBadge = (r.badge_text || '').toLowerCase().includes(q);
        return matchName || matchDesc || matchBadge;
      }
      return true;
    });
  }, [rules, filterStatus, filterAudience, searchQuery]);

  // Contagens dos cards de resumo
  const metrics = useMemo(() => {
    const total = rules.length;
    const activeCount = rules.filter((r) => r.active).length;
    const employeeRules = rules.filter((r) => r.employee_criteria === 'only_employees').length;
    const regionalRules = rules.filter((r) => r.target_regions?.length > 0 || r.target_states?.length > 0).length;
    return { total, activeCount, employeeRules, regionalRules };
  }, [rules]);

  // Filtros de busca no modal
  const filteredProdsForSelect = useMemo(() => {
    if (!searchProd.trim()) return [];
    const q = searchProd.toLowerCase();
    return products
      .filter((p) => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
      .slice(0, 10);
  }, [products, searchProd]);

  const filteredProdsForExclude = useMemo(() => {
    if (!searchExcluded.trim()) return [];
    const q = searchExcluded.toLowerCase();
    return products
      .filter((p) => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
      .slice(0, 10);
  }, [products, searchExcluded]);

  const filteredUsersForSelect = useMemo(() => {
    if (!searchUser.trim()) return [];
    const q = searchUser.toLowerCase();
    return usersList
      .filter((u) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.cpf || '').includes(q))
      .slice(0, 10);
  }, [usersList, searchUser]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="admin-discount-rules-page">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Percent className="w-7 h-7 text-emerald-600" /> Regras de Desconto & Promoções
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure descontos dinâmicos por funcionário, região do Brasil, primeira compra, categoria ou exceções de produtos.
          </p>
        </div>
        <Button
          onClick={openNew}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-sm"
          data-testid="btn-new-rule"
        >
          <Plus className="w-4 h-4" /> Nova Regra de Desconto
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Regras</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{metrics.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Regras Ativas
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{metrics.activeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Funcionários
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1">{metrics.employeeRules}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> Regionais (Brasil)
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">{metrics.regionalRules}</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, descrição ou selo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
            data-testid="input-search-rule"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-medium text-slate-700 outline-hidden"
          >
            <option value="all">Todos os status</option>
            <option value="active">Apenas Ativas</option>
            <option value="inactive">Apenas Inativas</option>
          </select>

          <select
            value={filterAudience}
            onChange={(e) => setFilterAudience(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-medium text-slate-700 outline-hidden"
          >
            <option value="all">Todos os públicos</option>
            <option value="employees">Apenas Funcionários</option>
            <option value="first_purchase">Primeira Compra</option>
            <option value="regions">Por Região/UF</option>
          </select>
        </div>
      </div>

      {/* Tabela de Regras */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Carregando regras de desconto...</div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Percent className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Nenhuma regra de desconto encontrada</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Crie regras automáticas para conceder descontos para funcionários, estados específicos, primeira compra ou categorias selecionadas.
            </p>
            <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold mt-2">
              <Plus className="w-3.5 h-3.5 mr-1" /> Criar primeira regra
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Regra & Destaque</th>
                  <th className="py-3.5 px-4">Desconto</th>
                  <th className="py-3.5 px-4">Público-Alvo</th>
                  <th className="py-3.5 px-4">Escopo & Exceções</th>
                  <th className="py-3.5 px-4">Vigência</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map((rule) => {
                  const isPct = rule.discount_type === 'percent';
                  const valFmt = isPct ? `${rule.discount_value}%` : formatCurrency(rule.discount_value);
                  const hasExcluded = rule.excluded_products?.length > 0;

                  return (
                    <tr key={rule.rule_id} className="hover:bg-slate-50/70 transition" data-testid={`rule-row-${rule.rule_id}`}>
                      {/* Nome e Selo */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 text-sm">{rule.name}</div>
                        {rule.badge_text && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                            {rule.badge_text}
                          </span>
                        )}
                        {rule.description && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">{rule.description}</div>
                        )}
                      </td>

                      {/* Desconto */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {valFmt} OFF
                        </span>
                        {rule.max_discount && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            Teto máx: {formatCurrency(rule.max_discount)}
                          </div>
                        )}
                      </td>

                      {/* Público-Alvo */}
                      <td className="py-3.5 px-4 space-y-1">
                        {rule.employee_criteria === 'only_employees' && (
                          <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-1.5 py-0.5 text-[10px] font-bold mr-1">
                            👤 Funcionários
                          </span>
                        )}
                        {rule.only_first_purchase && (
                          <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 text-[10px] font-bold mr-1">
                            🌟 1ª Compra
                          </span>
                        )}
                        {(rule.target_regions?.length > 0 || rule.target_states?.length > 0) && (
                          <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 text-[10px] font-bold mr-1">
                            📍 {rule.target_regions?.map((r) => r.toUpperCase()).join(', ')} {rule.target_states?.length ? `(${rule.target_states.join(', ')})` : ''}
                          </span>
                        )}
                        {rule.target_audience === 'user_categories' && rule.target_user_categories?.length > 0 && (
                          <div className="text-[10px] text-slate-600">
                            Tags: {rule.target_user_categories.map((cid) => userCatsMap[cid]?.name || cid).join(', ')}
                          </div>
                        )}
                        {rule.target_audience === 'specific_users' && (
                          <div className="text-[10px] text-slate-600">
                            {rule.target_user_ids?.length || 0} usuário(s) específico(s)
                          </div>
                        )}
                        {rule.target_audience === 'all' && rule.employee_criteria === 'all' && !rule.only_first_purchase && !rule.target_regions?.length && !rule.target_states?.length && (
                          <span className="text-slate-500 text-[11px]">Todos os clientes</span>
                        )}
                      </td>

                      {/* Escopo & Exceções */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="font-medium text-slate-700">
                          {rule.product_scope === 'all' && 'Todos os produtos'}
                          {rule.product_scope === 'categories' && `${rule.applicable_categories?.length || 0} categorias`}
                          {rule.product_scope === 'subcategories' && `${rule.applicable_subcategories?.length || 0} subcategorias`}
                          {rule.product_scope === 'products' && `${rule.applicable_products?.length || 0} produtos`}
                        </div>
                        {hasExcluded && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            <Ban className="w-2.5 h-2.5" /> Menos {rule.excluded_products.length} produto(s)
                          </div>
                        )}
                        {rule.exclude_on_sale && (
                          <div className="text-[10px] text-slate-500">Exclui ofertas</div>
                        )}
                      </td>

                      {/* Vigência & Usos */}
                      <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                        {rule.valid_from || rule.valid_until ? (
                          <div>
                            {rule.valid_from ? `De ${rule.valid_from.slice(0, 10)}` : ''}
                            {rule.valid_until ? ` até ${rule.valid_until.slice(0, 10)}` : ''}
                          </div>
                        ) : (
                          <span className="text-slate-400">Sem expiração</span>
                        )}
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Usos: <span className="font-bold text-slate-700">{rule.times_used || 0}</span>
                          {rule.usage_limit ? ` / ${rule.usage_limit}` : ''}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(rule.rule_id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            rule.active ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                          title={rule.active ? 'Clique para desativar' : 'Clique para ativar'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              rule.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRule(rule)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                            title="Duplicar regra"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(rule)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rule.rule_id, rule.name)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">
                    {editingId ? 'Editar Regra de Desconto' : 'Nova Regra de Desconto'}
                  </h2>
                  <p className="text-xs text-slate-500">Defina o público, condições, valores e produtos elegíveis.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Abas */}
            <div className="flex border-b border-slate-200 px-5 bg-white text-xs font-bold gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'general'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Tag className="w-3.5 h-3.5" /> 1. Desconto & Identificação
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audience')}
                className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'audience'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> 2. Público & Região
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'products'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5" /> 3. Produtos & Exceções
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('conditions')}
                className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'conditions'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> 4. Condições & Vigência
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ABA 1: Identificação & Desconto */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Regra *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Desconto Funcionários 15%"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                        data-testid="input-rule-name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Selo / Badge no Checkout (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 15% OFF Funcionários"
                        value={form.badge_text}
                        onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-500"
                        data-testid="input-rule-badge"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Texto de destaque exibido para o cliente no carrinho e no resumo do pedido.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Descrição Interna (opcional)</label>
                    <textarea
                      rows={2}
                      placeholder="Detalhes internos sobre a campanha ou regra de desconto..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" /> Valor do Desconto
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Desconto</label>
                        <select
                          value={form.discount_type}
                          onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="percent">Percentual (%)</option>
                          <option value="fixed">Valor Fixo (R$)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {form.discount_type === 'percent' ? 'Percentual (0 a 100%) *' : 'Valor (R$) *'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={form.discount_type === 'percent' ? 100 : undefined}
                          required
                          value={form.discount_value}
                          onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-bold text-emerald-700 text-sm"
                          data-testid="input-rule-value"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Desconto Máximo / Teto (R$) <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Sem teto"
                          value={form.max_discount}
                          onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Prioridade de Aplicação
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Maior número = maior prioridade quando múltiplas regras forem elegíveis.
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-6">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(e) => setForm({ ...form, active: e.target.checked })}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span className="text-xs font-bold text-slate-800">Regra Ativa imediatamente</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: Público & Região */}
              {activeTab === 'audience' && (
                <div className="space-y-5">
                  {/* Critério de Funcionário */}
                  <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4">
                    <label className="block text-xs font-bold text-indigo-900 mb-2 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" /> Critério de Funcionário
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                          form.employee_criteria === 'all'
                            ? 'bg-white border-indigo-500 font-bold text-indigo-900 shadow-xs'
                            : 'bg-white/60 border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="employee_criteria"
                          value="all"
                          checked={form.employee_criteria === 'all'}
                          onChange={() => setForm({ ...form, employee_criteria: 'all' })}
                          className="accent-indigo-600"
                        />
                        Todos os clientes
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                          form.employee_criteria === 'only_employees'
                            ? 'bg-white border-indigo-500 font-bold text-indigo-900 shadow-xs'
                            : 'bg-white/60 border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="employee_criteria"
                          value="only_employees"
                          checked={form.employee_criteria === 'only_employees'}
                          onChange={() => setForm({ ...form, employee_criteria: 'only_employees' })}
                          className="accent-indigo-600"
                        />
                        ⭐ Apenas Funcionários
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                          form.employee_criteria === 'exclude_employees'
                            ? 'bg-white border-indigo-500 font-bold text-indigo-900 shadow-xs'
                            : 'bg-white/60 border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="employee_criteria"
                          value="exclude_employees"
                          checked={form.employee_criteria === 'exclude_employees'}
                          onChange={() => setForm({ ...form, employee_criteria: 'exclude_employees' })}
                          className="accent-indigo-600"
                        />
                        Apenas Não Funcionários
                      </label>
                    </div>
                  </div>

                  {/* Critério Primeira Compra */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" /> Desconto de Primeira Compra
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Válido exclusivamente para clientes que ainda não concluíram nenhum pedido pago na loja.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.only_first_purchase}
                        onChange={(e) => setForm({ ...form, only_first_purchase: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="text-xs font-bold text-emerald-900">Apenas 1ª Compra</span>
                    </label>
                  </div>

                  {/* Critério Regional do Brasil */}
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-600" /> Região do Brasil ou Estados (UFs)
                      </div>
                      {(form.target_regions?.length > 0 || form.target_states?.length > 0) && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, target_regions: [], target_states: [] })}
                          className="text-[10px] text-amber-800 underline font-semibold"
                        >
                          Limpar filtro regional (Todo o Brasil)
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Selecione macrorregiões ou estados específicos. Se nada for marcado, o desconto é válido para todo o Brasil.
                    </p>

                    {/* Macrorregiões */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700">Por Macrorregião:</span>
                      <div className="flex flex-wrap gap-2">
                        {BRAZIL_REGIONS_DEF.map((reg) => {
                          const isSel = (form.target_regions || []).includes(reg.id);
                          return (
                            <button
                              type="button"
                              key={reg.id}
                              onClick={() => toggleRegion(reg.id)}
                              className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                                isSel
                                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {isSel && <Check className="w-3 h-3" />}
                              {reg.name} ({reg.states.join(', ')})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* UFs individuais */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-700">Ou por Estado individual (UF):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_UF_LIST.map((uf) => {
                          const isSel = (form.target_states || []).includes(uf);
                          return (
                            <button
                              type="button"
                              key={uf}
                              onClick={() => toggleState(uf)}
                              className={`text-[11px] px-2 py-1 rounded font-bold border transition ${
                                isSel
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400'
                              }`}
                            >
                              {uf}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Tipo de Público (Todos, Categorias ou Usuários Específicos) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-slate-800">Segmentação de Clientes</label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="target_audience"
                          value="all"
                          checked={form.target_audience === 'all'}
                          onChange={() => setForm({ ...form, target_audience: 'all' })}
                          className="accent-emerald-600"
                        />
                        Todos os clientes
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="target_audience"
                          value="user_categories"
                          checked={form.target_audience === 'user_categories'}
                          onChange={() => setForm({ ...form, target_audience: 'user_categories' })}
                          className="accent-emerald-600"
                        />
                        Categorias de Usuários
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="target_audience"
                          value="specific_users"
                          checked={form.target_audience === 'specific_users'}
                          onChange={() => setForm({ ...form, target_audience: 'specific_users' })}
                          className="accent-emerald-600"
                        />
                        Usuários Específicos
                      </label>
                    </div>

                    {/* Categorias de Usuários */}
                    {form.target_audience === 'user_categories' && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <span className="text-[11px] font-bold text-slate-700">Selecione as categorias de usuário:</span>
                        <div className="flex flex-wrap gap-2">
                          {userCats.map((c) => {
                            const isSel = (form.target_user_categories || []).includes(c.category_id);
                            return (
                              <button
                                type="button"
                                key={c.category_id}
                                onClick={() => toggleArrayItem('target_user_categories', c.category_id)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition font-bold ${
                                  isSel
                                    ? 'bg-indigo-600 text-white border-indigo-700'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {isSel && '✓ '} {c.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Usuários Específicos */}
                    {form.target_audience === 'specific_users' && (
                      <div className="pt-2 border-t border-slate-200 space-y-3">
                        <span className="text-[11px] font-bold text-slate-700">Buscar e adicionar clientes:</span>
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Digite o nome, email ou CPF do cliente..."
                            value={searchUser}
                            onChange={(e) => setSearchUser(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg outline-hidden"
                          />
                        </div>

                        {filteredUsersForSelect.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100 shadow-sm">
                            {filteredUsersForSelect.map((u) => {
                              const alreadyAdded = (form.target_user_ids || []).includes(u.user_id);
                              return (
                                <div key={u.user_id} className="p-2 flex items-center justify-between text-xs hover:bg-slate-50">
                                  <div>
                                    <div className="font-bold text-slate-800">{u.name || 'Sem nome'}</div>
                                    <div className="text-[11px] text-slate-500">{u.email} {u.cpf ? `· CPF ${u.cpf}` : ''}</div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={alreadyAdded}
                                    onClick={() => addTargetUser(u)}
                                    className={`text-[10px] h-7 ${alreadyAdded ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white'}`}
                                  >
                                    {alreadyAdded ? 'Adicionado' : '+ Adicionar'}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Chips de usuários selecionados */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(form.target_user_ids || []).map((uid) => {
                            const u = usersList.find((usr) => usr.user_id === uid);
                            return (
                              <span
                                key={uid}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-200 text-slate-800"
                              >
                                {u?.name || u?.email || uid}
                                <button
                                  type="button"
                                  onClick={() => removeTargetUser(uid)}
                                  className="text-slate-500 hover:text-rose-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 3: Produtos & Exceções */}
              {activeTab === 'products' && (
                <div className="space-y-6">
                  {/* Escopo Principal */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-emerald-600" /> Escopo dos Produtos Elegíveis
                    </label>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, product_scope: 'all' })}
                        className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                          form.product_scope === 'all'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-sm font-black">Todos</div>
                        <div className="text-[10px] opacity-80 mt-0.5">Toda a loja</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, product_scope: 'categories' })}
                        className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                          form.product_scope === 'categories'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-sm font-black">Categorias</div>
                        <div className="text-[10px] opacity-80 mt-0.5">Por categorias</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, product_scope: 'subcategories' })}
                        className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                          form.product_scope === 'subcategories'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-sm font-black">Subcategorias</div>
                        <div className="text-[10px] opacity-80 mt-0.5">Por subcategorias</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, product_scope: 'products' })}
                        className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                          form.product_scope === 'products'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-sm font-black">Produtos/SKUs</div>
                        <div className="text-[10px] opacity-80 mt-0.5">Itens específicos</div>
                      </button>
                    </div>

                    {/* Categorias selecionadas */}
                    {form.product_scope === 'categories' && (
                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        <span className="text-[11px] font-bold text-slate-700">Selecione as categorias que recebem desconto:</span>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                          {prodCats.map((cat) => {
                            const isSel = (form.applicable_categories || []).includes(cat.category_id) || (form.applicable_categories || []).includes(cat.name);
                            return (
                              <button
                                type="button"
                                key={cat.category_id || cat.name}
                                onClick={() => toggleArrayItem('applicable_categories', cat.category_id || cat.name)}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition ${
                                  isSel ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {isSel && '✓ '} {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Subcategorias selecionadas */}
                    {form.product_scope === 'subcategories' && (
                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        <span className="text-[11px] font-bold text-slate-700">Selecione as subcategorias:</span>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                          {prodSubs.map((sub) => {
                            const isSel = (form.applicable_subcategories || []).includes(sub.subcategory_id) || (form.applicable_subcategories || []).includes(sub.name);
                            return (
                              <button
                                type="button"
                                key={sub.subcategory_id || sub.name}
                                onClick={() => toggleArrayItem('applicable_subcategories', sub.subcategory_id || sub.name)}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition ${
                                  isSel ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {isSel && '✓ '} {sub.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Produtos selecionados */}
                    {form.product_scope === 'products' && (
                      <div className="pt-3 border-t border-slate-200 space-y-3">
                        <span className="text-[11px] font-bold text-slate-700">Buscar produtos elegíveis:</span>
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Digite o nome ou SKU do produto..."
                            value={searchProd}
                            onChange={(e) => setSearchProd(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg outline-hidden"
                          />
                        </div>

                        {filteredProdsForSelect.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100 shadow-sm">
                            {filteredProdsForSelect.map((p) => {
                              const alreadyAdded = (form.applicable_products || []).includes(p.product_id);
                              return (
                                <div key={p.product_id} className="p-2 flex items-center justify-between text-xs hover:bg-slate-50">
                                  <div>
                                    <div className="font-bold text-slate-800">{p.name}</div>
                                    <div className="text-[11px] text-slate-500">SKU: {p.sku || p.product_id} · {formatCurrency(p.price)}</div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={alreadyAdded}
                                    onClick={() => toggleArrayItem('applicable_products', p.product_id)}
                                    className={`text-[10px] h-7 ${alreadyAdded ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white'}`}
                                  >
                                    {alreadyAdded ? 'Incluído' : '+ Incluir'}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                          {(form.applicable_products || []).map((pid) => {
                            const p = prodsMap[pid];
                            return (
                              <span
                                key={pid}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                {p?.name || pid}
                                <button
                                  type="button"
                                  onClick={() => toggleArrayItem('applicable_products', pid)}
                                  className="text-emerald-700 hover:text-rose-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* EXCEÇÕES: "Todos os produtos MENOS X, Y, Z produtos" */}
                  <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                        <Ban className="w-4 h-4 text-rose-600" /> Exceções: Produtos Excluídos ("Todos MENOS X, Y, Z produtos")
                      </div>
                      {form.excluded_products?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, excluded_products: [] })}
                          className="text-[10px] text-rose-700 underline font-semibold"
                        >
                          Limpar exclusões ({form.excluded_products.length})
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Os produtos selecionados abaixo <b>NUNCA receberão este desconto</b>, mesmo que façam parte de uma categoria elegível ou quando o escopo é "todos os produtos".
                    </p>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar produto para EXCLUIR da promoção..."
                        value={searchExcluded}
                        onChange={(e) => setSearchExcluded(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs border border-rose-300 rounded-lg outline-hidden bg-white"
                        data-testid="input-exclude-product"
                      />
                    </div>

                    {filteredProdsForExclude.length > 0 && (
                      <div className="bg-white border border-rose-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-rose-100 shadow-sm">
                        {filteredProdsForExclude.map((p) => {
                          const alreadyExcluded = (form.excluded_products || []).includes(p.product_id);
                          return (
                            <div key={p.product_id} className="p-2 flex items-center justify-between text-xs hover:bg-rose-50/50">
                              <div>
                                <div className="font-bold text-slate-800">{p.name}</div>
                                <div className="text-[11px] text-slate-500">SKU: {p.sku || p.product_id} · {formatCurrency(p.price)}</div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                disabled={alreadyExcluded}
                                onClick={() => addExcludedProduct(p.product_id)}
                                className={`text-[10px] h-7 ${alreadyExcluded ? 'bg-slate-100 text-slate-400' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                              >
                                {alreadyExcluded ? 'Excluído' : 'Excluir da Regra'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Chips de produtos excluídos */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(form.excluded_products || []).map((pid) => {
                        const p = prodsMap[pid];
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-rose-100 text-rose-900 border border-rose-300 font-semibold"
                          >
                            🚫 {p?.name || pid}
                            <button
                              type="button"
                              onClick={() => removeExcludedProduct(pid)}
                              className="text-rose-700 hover:text-rose-950"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Excluir produtos em promoção */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={form.exclude_on_sale}
                      onChange={(e) => setForm({ ...form, exclude_on_sale: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Não aplicar a produtos que já estejam em oferta / promoção</span>
                      <p className="text-[10px] text-slate-500">Impede desconto cumulativo sobre produtos com preço promocional (sale_price).</p>
                    </div>
                  </label>
                </div>
              )}

              {/* ABA 4: Condições & Vigência */}
              {activeTab === 'conditions' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Subtotal Mínimo do Pedido (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.min_subtotal}
                        onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Subtotal Máximo do Pedido (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Sem limite"
                        value={form.max_subtotal}
                        onChange={(e) => setForm({ ...form, max_subtotal: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Qtd. Mínima de Itens Elegíveis (volume)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Ex: 3 ou mais"
                        value={form.min_quantity}
                        onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Formas de Pagamento Específicas */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" /> Forma de Pagamento Específica (opcional)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Se você deseja conceder o desconto exclusivamente para Pix, Boleto ou Cartão, selecione abaixo. Se vazio, aplica a todas.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { id: 'pix', label: 'Pix' },
                        { id: 'credit_card', label: 'Cartão de Crédito' },
                        { id: 'boleto', label: 'Boleto Bancário' },
                      ].map((pm) => {
                        const isSel = (form.payment_methods || []).includes(pm.id);
                        return (
                          <button
                            type="button"
                            key={pm.id}
                            onClick={() => toggleArrayItem('payment_methods', pm.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition ${
                              isSel ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            {isSel && '✓ '} {pm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vigência / Período */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Válido A Partir De</label>
                      <input
                        type="date"
                        value={form.valid_from}
                        onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Válido Até (Expiração)</label>
                      <input
                        type="date"
                        value={form.valid_until}
                        onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Limites de Usos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Limite Total de Usos da Regra
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Ilimitado"
                        value={form.usage_limit}
                        onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Limite de Usos por Cliente (CPF)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Ilimitado (ex: 1 uso por cliente)"
                        value={form.per_user_limit}
                        onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Acúmulo com Cupom */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
                    <input
                      type="checkbox"
                      checked={form.allow_cumulative_coupon}
                      onChange={(e) => setForm({ ...form, allow_cumulative_coupon: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Permitir acumular com cupom digitado</span>
                      <p className="text-[10px] text-slate-500">Se desmarcado, esta regra não será aplicada se o cliente digitar um cupom de desconto no carrinho.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  {activeTab === 'general' && 'Passo 1 de 4: Defina o desconto e título'}
                  {activeTab === 'audience' && 'Passo 2 de 4: Selecione funcionários, regiões ou clientes'}
                  {activeTab === 'products' && 'Passo 3 de 4: Escolha o escopo e exceções de produtos'}
                  {activeTab === 'conditions' && 'Passo 4 de 4: Regras avançadas de valores e vigência'}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    loading={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5"
                    data-testid="btn-save-rule"
                  >
                    Salvar Regra de Desconto
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
