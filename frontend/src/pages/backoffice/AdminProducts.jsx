import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ImageIcon,
  Filter,
  X,
  RotateCcw,
  Calendar,
  Tag,
  SlidersHorizontal,
  Package,
  Layers,
  ArrowUpDown,
  LayoutList,
  LayoutGrid,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../../components/admin/Pagination';

const PAGE_LIMIT = 20;

export default function AdminProducts() {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modo de visualização: 'list' (lista) ou 'grid' (cards)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('admin_products_view_mode') || 'list';
  });

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('admin_products_view_mode', mode);
    } catch (_) {}
  };
  
  // Filtros
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [status, setStatus] = useState('all');
  const [stockStatus, setStockStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('order');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);

  // Drag and drop para reordenação
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isReordering, setIsReordering] = useState(false);

  // Paginação
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Carrega lista de categorias para o dropdown
  useEffect(() => {
    api.get('/api/admin/categories')
      .then(res => setCategories(res.categories || []))
      .catch(() => {
        api.get('/api/categories')
          .then(res => setCategories(res.categories || []))
          .catch(() => {});
      });
  }, []);

  const load = useCallback(async (targetPage) => {
    setLoading(true);
    const tp = typeof targetPage === 'number' ? targetPage : 1;
    try {
      const q = new URLSearchParams({ page: String(tp), limit: String(PAGE_LIMIT) });
      if (search.trim()) q.set('search', search.trim());
      if (category && category !== 'all') q.set('category', category);
      if (brand && brand !== 'all') q.set('brand', brand);
      if (status && status !== 'all') q.set('status', status);
      if (stockStatus && stockStatus !== 'all') q.set('stock_status', stockStatus);
      if (dateFrom) q.set('date_from', dateFrom);
      if (dateTo) q.set('date_to', dateTo);
      if (sortBy) q.set('sort_by', sortBy);

      const p = await api.get(`/api/admin/products?${q}`);
      setProducts(p.products || []);
      setPages(p.pages || 1);
      setTotal(p.total || 0);
      setPage(p.page || tp);
      if (p.available_brands && Array.isArray(p.available_brands)) {
        setBrands(p.available_brands);
      }
    } catch (err) {
      toast.error('Erro ao carregar produtos: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [search, category, brand, status, stockStatus, dateFrom, dateTo, sortBy]);

  // Recarrega sempre que qualquer filtro mudar, voltando pra página 1
  useEffect(() => {
    load(1);
  }, [load]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    category !== 'all' ||
    brand !== 'all' ||
    status !== 'all' ||
    stockStatus !== 'all' ||
    dateFrom ||
    dateTo ||
    sortBy !== 'order'
  );

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setBrand('all');
    setStatus('all');
    setStockStatus('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('order');
  };

  const del = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto "${name || id}"?`)) return;
    try {
      await api.del(`/api/admin/products/${id}`);
      toast.success('Produto excluído com sucesso');
      load(page);
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir produto');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch (_) {}
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...products];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    setProducts(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Enviar nova ordem para o backend
    setIsReordering(true);
    try {
      const startOrder = (page - 1) * PAGE_LIMIT;
      await api.post('/api/admin/products/reorder', {
        product_ids: reordered.map(p => p.product_id),
        start_order: startOrder,
      });
      toast.success('Ordem dos produtos atualizada com sucesso!', { id: 'reorder-toast', duration: 2500 });
    } catch (err) {
      toast.error('Erro ao salvar nova ordem: ' + (err.message || 'Falha na comunicação'));
      load(page);
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div data-testid="admin-products" className="space-y-5">
      {/* Top Header com Título, Switch de Visualização e Botão Novo Produto */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-black text-3xl text-txt-primary flex items-center gap-3">
            Produtos
            <span className="text-sm font-semibold bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
              {total} {total === 1 ? 'produto' : 'produtos'}
            </span>
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Gerencie o catálogo, preços, estoque, categorias e ordene arrastando os produtos.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Switch Lista vs Cards */}
          <div className="flex items-center bg-gray-100/90 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => changeViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Visualização em Lista"
              data-testid="view-mode-list"
            >
              <LayoutList className="w-4 h-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>

            <button
              type="button"
              onClick={() => changeViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Visualização em Cards"
              data-testid="view-mode-grid"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <Button onClick={() => nav('/backoffice/produtos/novo')} data-testid="new-product-btn" className="gap-2">
            <Plus className="w-4 h-4" /> Novo produto
          </Button>
        </div>
      </div>

      {/* Box de Filtros e Pesquisa */}
      <div className="bg-white rounded-2xl border border-border p-5 shadow-xs space-y-4">
        {/* Barra de Pesquisa Principal */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, descrição, marca ou SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-9 bg-bg-secondary/60 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white transition-all"
              data-testid="product-search"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-11 px-4 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors ${
                showAdvancedFilters
                  ? 'border-brand-main/40 bg-orange-50/60 text-brand-main'
                  : 'border-border bg-white text-txt-secondary hover:bg-bg-secondary'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-brand-main animate-pulse" />
              )}
            </button>

            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="h-11 px-3 text-xs gap-1.5 border-dashed text-txt-secondary hover:text-red-600 hover:border-red-300"
                title="Limpar todos os filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Grade de Filtros Avançados */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Categoria */}
            <div>
              <label className="text-xs font-semibold text-txt-secondary block mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-400" /> Categoria
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-10 px-3 bg-bg-secondary/60 border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                data-testid="filter-category"
              >
                <option value="all">Todas as categorias</option>
                {categories.map(c => (
                  <option key={c.category_id || c.slug} value={c.name}>
                    {c.name} {!c.active ? '(inativa)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Marca */}
            <div>
              <label className="text-xs font-semibold text-txt-secondary block mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-gray-400" /> Marca
              </label>
              <select
                value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full h-10 px-3 bg-bg-secondary/60 border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                data-testid="filter-brand"
              >
                <option value="all">Todas as marcas</option>
                {brands.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Status (Ativo / Inativo) */}
            <div>
              <label className="text-xs font-semibold text-txt-secondary block mb-1.5 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" /> Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full h-10 px-3 bg-bg-secondary/60 border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                data-testid="filter-status"
              >
                <option value="all">Todos os status</option>
                <option value="active">Somente Ativos</option>
                <option value="inactive">Somente Inativos</option>
              </select>
            </div>

            {/* Estoque */}
            <div>
              <label className="text-xs font-semibold text-txt-secondary block mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-gray-400" /> Estoque
              </label>
              <select
                value={stockStatus}
                onChange={e => setStockStatus(e.target.value)}
                className="w-full h-10 px-3 bg-bg-secondary/60 border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                data-testid="filter-stock"
              >
                <option value="all">Todo estoque</option>
                <option value="in_stock">Em estoque (&gt; 0)</option>
                <option value="out_of_stock">Esgotado / Sem estoque</option>
              </select>
            </div>

            {/* Data De */}
            <div>
              <label className="text-xs font-semibold text-txt-secondary block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Cadastrado de
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full h-10 px-3 bg-bg-secondary/60 border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                data-testid="filter-date-from"
              />
            </div>

            {/* Data Até */}
            <div>
              <label className="text-xs font-semibold text-txt-secondary block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Cadastrado até
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full h-10 px-3 bg-bg-secondary/60 border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                data-testid="filter-date-to"
              />
            </div>

            {/* Ordenação */}
            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-6 flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-txt-secondary" />
                <span className="text-xs font-semibold text-txt-secondary">Ordenar lista por:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="h-9 px-3 bg-bg-secondary/60 border border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                  data-testid="filter-sort"
                >
                  <option value="order">Ordem personalizada (arraste para mudar)</option>
                  <option value="created_at_desc">Mais recentes primeiro</option>
                  <option value="created_at_asc">Mais antigos primeiro</option>
                  <option value="name_asc">Nome (A - Z)</option>
                  <option value="name_desc">Nome (Z - A)</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="stock_desc">Maior estoque</option>
                  <option value="stock_asc">Menor estoque</option>
                </select>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {isReordering ? (
                  <span className="inline-flex items-center gap-1.5 text-brand-main font-semibold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando nova ordem...
                  </span>
                ) : (
                  <span className="text-txt-secondary hidden md:inline">
                    💡 <em>Dica: Arraste os itens para cima ou para baixo para reordenar a vitrine.</em>
                  </span>
                )}
                {hasActiveFilters && (
                  <div className="text-brand-main font-semibold flex items-center gap-2">
                    <span>Filtros aplicados ({total})</span>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="underline hover:text-orange-700"
                    >
                      Redefinir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo: Tabela (Lista) ou Grade (Cards) */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-border">
          <Loader2 className="w-9 h-9 animate-spin inline text-brand-main" />
          <p className="text-sm text-txt-secondary mt-3">Carregando catálogo de produtos...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-txt-secondary shadow-xs">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-base text-gray-800">Nenhum produto encontrado</div>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Tente ajustar seus termos de pesquisa ou remover filtros aplicados.
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mt-4 gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar filtros de pesquisa
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= VISUALIZAÇÃO EM CARDS ================= */
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p, idx) => {
              const isDragging = draggedIndex === idx;
              const isOver = dragOverIndex === idx;

              return (
                <div
                  key={p.product_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden group select-none ${
                    isDragging
                      ? 'opacity-40 border-dashed border-brand-main scale-95 shadow-inner'
                      : isOver
                      ? 'border-brand-main ring-2 ring-brand-main/40 shadow-lg -translate-y-1'
                      : 'border-border hover:border-gray-300 hover:shadow-md'
                  }`}
                  data-testid={`product-card-${p.product_id}`}
                >
                  {/* Top: Imagem com Grip Handle e Badges */}
                  <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                    {(p.images || [])[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                      />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-gray-300" />
                    )}

                    {/* Grip Handle para Arrastar */}
                    <div
                      className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-white/90 backdrop-blur-xs text-gray-500 hover:text-brand-main shadow-xs cursor-grab active:cursor-grabbing border border-gray-200/80 transition-colors"
                      title="Clique e arraste para reordenar"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Badges de Status */}
                    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 pointer-events-none">
                      {p.active ? (
                        <Badge variant="success" className="shadow-xs">Ativo</Badge>
                      ) : (
                        <Badge variant="error" className="shadow-xs">Inativo</Badge>
                      )}
                      {p.featured && <Badge variant="brand" className="shadow-xs">Destaque</Badge>}
                    </div>
                  </div>

                  {/* Informações do Produto */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-txt-secondary mb-1">
                        <span className="font-medium truncate text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md max-w-[150px]">
                          {p.category || 'Sem categoria'}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400">
                          {p.created_at ? formatDate(p.created_at) : ''}
                        </span>
                      </div>

                      <h3
                        onClick={() => nav(`/backoffice/produtos/${p.product_id}`)}
                        className="font-bold text-sm text-gray-900 line-clamp-2 hover:text-brand-main cursor-pointer transition-colors mt-1.5"
                        title={p.name}
                      >
                        {p.name}
                      </h3>

                      <div className="flex items-center gap-2 mt-1.5 text-xs text-txt-secondary flex-wrap">
                        {p.brand && <span className="font-semibold text-gray-700 bg-orange-50/70 text-brand-main px-1.5 py-0.5 rounded text-[11px]">{p.brand}</span>}
                        {p.sku && <span className="text-[11px] text-gray-400">SKU: {p.sku}</span>}
                      </div>
                    </div>

                    {/* Preço e Estoque */}
                    <div className="pt-3 border-t border-gray-100 flex items-end justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Preço</div>
                        {p.discount_price ? (
                          <div>
                            <span className="font-extrabold text-base text-gray-900">{formatCurrency(p.discount_price)}</span>
                            <span className="text-xs line-through text-gray-400 ml-1.5">{formatCurrency(p.price)}</span>
                          </div>
                        ) : (
                          <span className="font-extrabold text-base text-gray-900">{formatCurrency(p.price)}</span>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Estoque</div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          (p.stock || 0) <= 0
                            ? 'bg-red-50 text-red-600'
                            : (p.stock || 0) < 5
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {p.stock ?? 0} unid.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nav(`/backoffice/produtos/${p.product_id}`)}
                      className="flex-1 text-xs gap-1.5 h-8 bg-white hover:bg-orange-50 hover:text-brand-main hover:border-brand-main/40"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => del(p.product_id, p.name)}
                      className="text-xs h-8 px-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border border-border p-4 shadow-xs">
            <Pagination
              page={page}
              pages={pages}
              total={total}
              limit={PAGE_LIMIT}
              onChange={(p) => load(p)}
              testId="products-pagination"
            />
          </div>
        </div>
      ) : (
        /* ================= VISUALIZAÇÃO EM LISTA (TABELA) ================= */
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary/70 text-xs uppercase text-txt-secondary border-b border-border">
                <tr>
                  <th className="p-3.5 pl-4 w-10 text-center font-semibold" title="Arrastar para reordenar">
                    <GripVertical className="w-4 h-4 mx-auto text-gray-400" />
                  </th>
                  <th className="text-left p-3.5 font-semibold">Produto</th>
                  <th className="text-left p-3.5 font-semibold">Categoria</th>
                  <th className="text-center p-3.5 font-semibold">Data Cadastro</th>
                  <th className="text-right p-3.5 font-semibold">Preço</th>
                  <th className="text-right p-3.5 font-semibold">Estoque</th>
                  <th className="text-center p-3.5 font-semibold">Status</th>
                  <th className="text-right p-3.5 pr-5 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {products.map((p, idx) => {
                  const isDragging = draggedIndex === idx;
                  const isOver = dragOverIndex === idx;

                  return (
                    <tr
                      key={p.product_id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`transition-colors ${
                        isDragging
                          ? 'opacity-40 bg-orange-50/60 border-brand-main border-dashed'
                          : isOver
                          ? 'bg-orange-50/80 ring-2 ring-brand-main/30'
                          : 'hover:bg-orange-50/20'
                      }`}
                      data-testid={`product-row-${p.product_id}`}
                    >
                      {/* Alça de Arraste (Drag Handle) */}
                      <td className="p-3 pl-4 text-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-brand-main">
                        <GripVertical className="w-4 h-4 mx-auto" />
                      </td>

                      {/* Produto */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-bg-secondary overflow-hidden flex-shrink-0 border border-gray-100 flex items-center justify-center">
                            {(p.images || [])[0] ? (
                              <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-md">
                            <div
                              onClick={() => nav(`/backoffice/produtos/${p.product_id}`)}
                              className="font-semibold text-txt-primary truncate hover:text-brand-main cursor-pointer"
                              title={p.name}
                            >
                              {p.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-txt-secondary">
                              {p.brand && (
                                <span className="font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {p.brand}
                                </span>
                              )}
                              {p.sku && <span>SKU: {p.sku}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="p-3.5 text-txt-secondary font-medium">
                        {p.category || '-'}
                      </td>

                      {/* Data de Cadastro */}
                      <td className="p-3.5 text-center text-xs text-txt-secondary font-mono">
                        {p.created_at ? formatDate(p.created_at) : '-'}
                      </td>

                      {/* Preço */}
                      <td className="p-3.5 text-right font-medium">
                        {p.discount_price ? (
                          <>
                            <div className="font-bold text-gray-900">{formatCurrency(p.discount_price)}</div>
                            <div className="text-xs line-through text-txt-secondary">{formatCurrency(p.price)}</div>
                          </>
                        ) : (
                          <span className="font-bold text-gray-900">{formatCurrency(p.price)}</span>
                        )}
                      </td>

                      {/* Estoque */}
                      <td className="p-3.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          (p.stock || 0) <= 0
                            ? 'bg-red-50 text-red-600'
                            : (p.stock || 0) < 5
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {p.stock ?? 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center space-x-1">
                        {p.active ? (
                          <Badge variant="success">Ativo</Badge>
                        ) : (
                          <Badge variant="error">Inativo</Badge>
                        )}
                        {p.featured && <Badge variant="brand">Destaque</Badge>}
                      </td>

                      {/* Ações */}
                      <td className="p-3.5 pr-5 text-right space-x-1">
                        <button
                          onClick={() => nav(`/backoffice/produtos/${p.product_id}`)}
                          className="p-2 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors inline-flex items-center"
                          title="Editar produto"
                          data-testid={`edit-${p.product_id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(p.product_id, p.name)}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors inline-flex items-center"
                          title="Excluir produto"
                          data-testid={`del-${p.product_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-border">
            <Pagination
              page={page}
              pages={pages}
              total={total}
              limit={PAGE_LIMIT}
              onChange={(p) => load(p)}
              testId="products-pagination"
            />
          </div>
        </div>
      )}
    </div>
  );
}
