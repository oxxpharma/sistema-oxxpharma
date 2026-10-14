import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  User,
  Search,
  Menu,
  X,
  LogOut,
  Package,
  MapPin,
  Share2,
  LayoutDashboard,
  Network,
  Award,
  Building2,
  ChevronDown,
  Loader2,
  ArrowRight,
  Tag
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useReferral } from '../../contexts/RefContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { api } from '../../lib/api';
import BrandLogo from '../branding/BrandLogo';

export default function StoreHeader() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { cart } = useCart();
  const { refName } = useReferral();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSiteSettings();

  // Estados de navegação e menus
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({ products: [], categories: [], subcategories: [] });

  // Estados do submenu de Produtos
  const [productsHovered, setProductsHovered] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const searchInputRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // Redes do usuário
  const userNetworks = Array.isArray(user?.networks) && user.networks.length
    ? user.networks
    : [user?.network_type].filter(Boolean);
  const isPropagandista = userNetworks.includes('network_2');
  const inMmnNetwork = userNetworks.some(n => n === 'network_1' || n === 'network_2');
  const showMyNetwork = isAuthenticated && (isAdmin || inMmnNetwork);
  const showPropagandistaArea = isAuthenticated && (isAdmin || isPropagandista);

  // Carrega categorias e subcategorias ativas para o submenu
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/api/categories').catch(() => ({ categories: [] })),
      api.get('/api/subcategories').catch(() => ({ subcategories: [] }))
    ]).then(([catsResp, subsResp]) => {
      if (!alive) return;
      const activeCats = (catsResp.categories || []).filter(c => c.active !== false);
      const activeSubs = (subsResp.subcategories || []).filter(s => s.active !== false);
      setCategories(activeCats);
      setSubcategories(activeSubs);
      if (activeCats.length > 0) {
        setHoveredCategory(activeCats[0]);
      }
    });
    return () => { alive = false; };
  }, []);

  // Foco no input ao abrir a busca avançada
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [searchOpen]);

  // Busca avançada instantânea ao digitar
  useEffect(() => {
    if (!searchOpen || !searchTerm.trim()) {
      setSearchResults({ products: [], categories: [], subcategories: [] });
      setSearchLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.get(`/api/search/live?q=${encodeURIComponent(searchTerm.trim())}`);
        setSearchResults({
          products: data.products || [],
          categories: data.categories || [],
          subcategories: data.subcategories || []
        });
      } catch (err) {
        console.error('Falha na busca live:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchTerm, searchOpen]);

  // Tecla Escape para fechar busca ou menus
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
        setProductsHovered(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Itens do menu superior customizáveis (com fallback padrão)
  const navItems = Array.isArray(settings?.header_nav_items) && settings.header_nav_items.length > 0
    ? settings.header_nav_items
    : [
        { label: 'Protocolo Dr.Bactéria', url: '/p/protocolo-dr-bacteria' },
        { label: 'Óleos Ozonizados', url: '/categoria/oleos-ozonizados' },
        { label: 'Quem Somos', url: '/p/sobre' },
        { label: 'Blog', url: '/p/blog' },
        { label: 'Contato', url: '/p/contato' },
      ];

  // Helper para verificar item ativo e mostrar barra laranja discreta
  const isItemActive = (url) => {
    if (!url) return false;
    if (url === '/') return location.pathname === '/';
    if (url === '/produtos') {
      return (
        location.pathname === '/produtos' ||
        location.pathname.startsWith('/categoria') ||
        location.pathname.startsWith('/subcategoria')
      );
    }
    return location.pathname === url || (url !== '/' && location.pathname.startsWith(url));
  };

  const handleProductsEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setProductsHovered(true);
  };

  const handleProductsLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setProductsHovered(false);
    }, 180);
  };

  const executeFullSearch = (e) => {
    e?.preventDefault();
    if (searchTerm.trim()) {
      setSearchOpen(false);
      navigate(`/buscar?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  // Subcategorias filtradas da categoria sob hover
  const activeCategorySubs = hoveredCategory
    ? subcategories.filter(s =>
        Array.isArray(s.category_ids) && s.category_ids.includes(hoveredCategory.category_id)
      )
    : [];

  return (
    <>
      {/* Top Announcement Bar se configurado */}
      {settings?.announcement_bar_enabled && settings?.announcement_bar_text && (
        <a
          href={settings.announcement_bar_link || '#'}
          className="block text-center text-xs py-2 px-4 font-medium text-white transition hover:opacity-95"
          style={{ backgroundColor: settings.announcement_bar_bg_color || '#E8731A' }}
          data-testid="announcement-bar"
        >
          {settings.announcement_bar_text}
        </a>
      )}

      {/* Banner de Indicação se houver patrocinador */}
      {refName && (
        <div className="bg-brand-light text-brand-main text-center text-xs py-2 px-4 font-medium border-b border-orange-100" data-testid="ref-banner">
          <Share2 className="w-3.5 h-3.5 inline mr-1.5" />
          Você está comprando através da indicação de <strong>{refName}</strong>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header
        className="bg-white border-b border-gray-100/80 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.06)] sticky top-0 z-40 transition-all"
        data-testid="store-header"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo à esquerda */}
          <Link to="/" className="flex items-center gap-2 shrink-0 py-2" data-testid="logo-link">
            <BrandLogo
              slot="store_header"
              variant="light"
              textClassName="font-heading font-black text-2xl text-txt-primary tracking-tight"
            />
          </Link>

          {/* Menu Centralizado (Desktop) */}
          <nav className="hidden lg:flex items-center justify-center gap-7 xl:gap-8 flex-1 px-4">
            
            {/* Item Fixo: Início */}
            <Link
              to="/"
              className={`relative py-2 text-sm font-medium transition-colors ${
                isItemActive('/') ? 'text-gray-900 font-semibold' : 'text-gray-700 hover:text-brand-main'
              }`}
            >
              Início
              {isItemActive('/') && (
                <span className="absolute -bottom-2.5 left-0 right-0 h-[2.5px] bg-brand-main rounded-full" />
              )}
            </Link>

            {/* Item Fixo: Produtos com Submenu em Cascata */}
            <div
              className="relative"
              onMouseEnter={handleProductsEnter}
              onMouseLeave={handleProductsLeave}
            >
              <Link
                to="/produtos"
                className={`relative py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  isItemActive('/produtos') || productsHovered ? 'text-gray-900 font-semibold' : 'text-gray-700 hover:text-brand-main'
                }`}
              >
                <span>Produtos</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${productsHovered ? 'rotate-180 text-brand-main' : 'text-gray-500'}`} />
                {isItemActive('/produtos') && (
                  <span className="absolute -bottom-2.5 left-0 right-0 h-[2.5px] bg-brand-main rounded-full" />
                )}
              </Link>

              {/* Submenu Dropdown de 2 Níveis */}
              {productsHovered && (
                <div className="absolute top-full left-0 pt-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="relative flex items-start">
                    
                    {/* Painel 1: Categorias */}
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 min-w-[210px] w-56">
                      <div className="text-xs font-bold text-brand-main text-center pb-2 mb-1.5 border-b border-gray-100 tracking-wide">
                        Categorias
                      </div>
                      
                      <div className="space-y-1">
                        {categories.map((cat) => {
                          const isHovered = hoveredCategory?.category_id === cat.category_id;
                          return (
                            <div
                              key={cat.category_id || cat.slug}
                              onMouseEnter={() => setHoveredCategory(cat)}
                              className={`flex items-center justify-between px-3 py-2 text-sm rounded-xl cursor-pointer transition-colors ${
                                isHovered
                                  ? 'bg-orange-50 text-brand-main font-semibold'
                                  : 'text-gray-700 hover:bg-orange-50/70 hover:text-brand-main'
                              }`}
                            >
                              <div className="flex items-center truncate">
                                <span className="text-brand-main font-bold mr-2 text-base leading-none">•</span>
                                <Link
                                  to={`/categoria/${cat.slug}`}
                                  onClick={() => setProductsHovered(false)}
                                  className="truncate"
                                >
                                  {cat.name}
                                </Link>
                              </div>
                              <span className="text-gray-400 text-xs ml-2 font-bold">&gt;</span>
                            </div>
                          );
                        })}

                        {categories.length === 0 && (
                          <div className="text-xs text-txt-secondary p-3 text-center">
                            Nenhuma categoria ativa.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Painel 2: Subcategorias (ao lado direito) */}
                    {hoveredCategory && (
                      <div className="ml-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 min-w-[230px] max-w-xs max-h-[460px] overflow-y-auto animate-in fade-in slide-in-from-left-2 duration-150">
                        <div className="text-xs font-bold text-gray-800 pb-2 mb-2 border-b border-gray-100 flex items-center justify-between">
                          <span>{hoveredCategory.name}</span>
                          <Link
                            to={`/categoria/${hoveredCategory.slug}`}
                            onClick={() => setProductsHovered(false)}
                            className="text-[11px] text-brand-main hover:underline font-normal"
                          >
                            Ver todos
                          </Link>
                        </div>

                        {activeCategorySubs.length > 0 ? (
                          <div className="space-y-1">
                            {activeCategorySubs.map((sub) => (
                              <Link
                                key={sub.subcategory_id || sub.slug}
                                to={`/subcategoria/${sub.slug}`}
                                onClick={() => setProductsHovered(false)}
                                className="flex items-center text-xs py-1.5 px-2 text-gray-700 hover:text-brand-main hover:translate-x-1 rounded-lg transition-all"
                              >
                                <span className="text-brand-main font-bold mr-2 text-base leading-none">•</span>
                                <span className="truncate">{sub.name}</span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="py-4 text-center">
                            <p className="text-xs text-txt-secondary mb-2">Sem subcategorias vinculadas.</p>
                            <Link
                              to={`/categoria/${hoveredCategory.slug}`}
                              onClick={() => setProductsHovered(false)}
                              className="text-xs text-brand-main font-semibold hover:underline"
                            >
                              Ver produtos de {hoveredCategory.name} &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Itens Personalizados Configurados no Admin */}
            {navItems.map((item, idx) => {
              const active = isItemActive(item.url);
              return (
                <Link
                  key={idx}
                  to={item.url || '#'}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    active ? 'text-gray-900 font-semibold' : 'text-gray-700 hover:text-brand-main'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-2.5 left-0 right-0 h-[2.5px] bg-brand-main rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Ações à Direita: Busca, Usuário e Carrinho */}
          <div className="flex items-center gap-2">
            
            {/* Ícone de Lupa (Abre a Barra de Pesquisa Avançada) */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2.5 rounded-full hover:bg-orange-50/70 text-gray-700 hover:text-brand-main transition"
              title="Pesquisa avançada"
              data-testid="search-btn"
            >
              <Search className="w-5 h-5 stroke-[2]" />
            </button>

            {/* Menu do Usuário */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`p-2.5 rounded-full transition ${
                  menuOpen
                    ? 'bg-orange-100/70 text-brand-main'
                    : 'hover:bg-orange-50/70 text-gray-700 hover:text-brand-main'
                }`}
                title="Minha Conta"
                data-testid="user-menu-btn"
              >
                <User className="w-5 h-5 stroke-[2]" />
              </button>

              {/* Dropdown do Usuário (Conforme Print Anexo) */}
              {menuOpen && (
                <div
                  className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 animate-in fade-in zoom-in-95 duration-150 z-50"
                  onMouseLeave={() => setMenuOpen(false)}
                  data-testid="user-menu"
                >
                  {/* Saudação */}
                  <div className="text-center font-medium text-sm text-gray-900 pb-3 mb-2 border-b border-gray-100">
                    {isAuthenticated ? (
                      <>
                        Olá <span className="text-brand-main font-bold">{user?.name?.split(' ')[0] || 'Usuário'}!</span>
                      </>
                    ) : (
                      <>
                        Olá <span className="text-brand-main font-bold">Visitante!</span>
                      </>
                    )}
                  </div>

                  {isAuthenticated ? (
                    <div className="space-y-1">
                      <Link
                        to="/minha-conta"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50/60 hover:text-brand-main rounded-xl transition"
                        onClick={() => setMenuOpen(false)}
                      >
                        <User className="w-4 h-4 text-gray-500" /> Minha conta
                      </Link>

                      <Link
                        to="/meus-pedidos"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50/60 hover:text-brand-main rounded-xl transition"
                        onClick={() => setMenuOpen(false)}
                        data-testid="my-orders-link"
                      >
                        <Package className="w-4 h-4 text-gray-500" /> Meus pedidos
                      </Link>

                      <Link
                        to="/meus-pontos"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50/60 hover:text-brand-main rounded-xl transition"
                        onClick={() => setMenuOpen(false)}
                        data-testid="my-points-link"
                      >
                        <Award className="w-4 h-4 text-gray-500" /> Meus {settings?.points_visibility_label || 'pontos'}
                      </Link>

                      <Link
                        to="/meus-enderecos"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50/60 hover:text-brand-main rounded-xl transition"
                        onClick={() => setMenuOpen(false)}
                      >
                        <MapPin className="w-4 h-4 text-gray-500" /> Endereços
                      </Link>

                      <Link
                        to="/indique-ganhe"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-brand-main font-semibold hover:bg-orange-50 rounded-xl transition"
                        onClick={() => setMenuOpen(false)}
                        data-testid="referral-link"
                      >
                        <Share2 className="w-4 h-4 text-brand-main" /> {settings?.referral_menu_label || 'Indique e ganhe benefícios'}
                      </Link>

                      {showMyNetwork && (
                        <Link
                          to="/minha-rede"
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50/60 hover:text-brand-main rounded-xl transition"
                          onClick={() => setMenuOpen(false)}
                          data-testid="my-network-link"
                        >
                          <Network className="w-4 h-4 text-gray-500" /> Minha Rede
                        </Link>
                      )}

                      {showPropagandistaArea && (
                        <Link
                          to="/propagandista/empresas"
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50/60 hover:text-brand-main rounded-xl transition"
                          onClick={() => setMenuOpen(false)}
                          data-testid="propagandista-empresas-link"
                        >
                          <Building2 className="w-4 h-4 text-gray-500" /> Minhas Empresas
                        </Link>
                      )}

                      {isAdmin && (
                        <>
                          <div className="border-t border-gray-100 my-1.5" />
                          <Link
                            to="/backoffice"
                            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50/60 hover:text-brand-main rounded-xl transition font-medium"
                            onClick={() => setMenuOpen(false)}
                            data-testid="backoffice-link"
                          >
                            <LayoutDashboard className="w-4 h-4 text-gray-500" /> Painel Admin
                          </Link>
                        </>
                      )}

                      <div className="border-t border-gray-100 my-1.5" />

                      <button
                        onClick={async () => {
                          await logout();
                          setMenuOpen(false);
                          navigate('/');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition font-medium"
                        data-testid="logout-btn"
                      >
                        <LogOut className="w-4 h-4 text-red-500" /> Sair
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <Link
                        to="/login"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-center py-2 px-3 bg-brand-main text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition shadow-sm"
                      >
                        Entrar na conta
                      </Link>
                      <Link
                        to="/cadastrar"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-center py-2 px-3 bg-bg-secondary text-gray-800 text-sm font-semibold rounded-xl hover:bg-gray-200 transition"
                      >
                        Criar cadastro
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ícone do Carrinho de Compras */}
            <Link
              to="/carrinho"
              className="relative p-2.5 rounded-full hover:bg-orange-50/70 text-gray-700 hover:text-brand-main transition"
              data-testid="cart-icon"
              title="Carrinho de Compras"
            >
              <ShoppingCart className="w-5 h-5 stroke-[2]" />
              {cart.count > 0 && (
                <span
                  className="absolute top-1 right-1 bg-brand-main text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow"
                  data-testid="cart-count"
                >
                  {cart.count}
                </span>
              )}
            </Link>

            {/* Botão Hambúrguer Mobile */}
            <button
              className="lg:hidden p-2.5 rounded-full hover:bg-bg-secondary text-gray-700"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Menu Mobile */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border px-4 py-5 bg-white space-y-4 animate-in slide-in-from-top duration-200">
            {/* Busca Mobile rápida */}
            <form onSubmit={executeFullSearch} className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produtos, categorias..."
                className="w-full pl-9 pr-3 py-2 bg-bg-secondary border border-border rounded-xl text-sm"
              />
            </form>

            <div className="space-y-1">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  isItemActive('/') ? 'text-brand-main bg-orange-50 font-semibold' : 'text-gray-700'
                }`}
              >
                Início
              </Link>

              {/* Produtos e categorias no mobile */}
              <details className="group">
                <summary className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-gray-700 cursor-pointer hover:bg-bg-secondary">
                  <span>Produtos</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="pl-4 pr-2 py-2 space-y-1 border-l-2 border-brand-main/30 ml-3 mt-1">
                  <Link
                    to="/produtos"
                    onClick={() => setMobileOpen(false)}
                    className="block py-1.5 text-xs font-bold text-brand-main"
                  >
                    Ver Todos os Produtos &rarr;
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.category_id}
                      to={`/categoria/${cat.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block py-1 text-xs text-gray-600 hover:text-brand-main"
                    >
                      • {cat.name}
                    </Link>
                  ))}
                </div>
              </details>

              {navItems.map((item, idx) => (
                <Link
                  key={idx}
                  to={item.url || '#'}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                    isItemActive(item.url) ? 'text-brand-main bg-orange-50 font-semibold' : 'text-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-border pt-3">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <div className="text-xs text-txt-secondary px-3 py-1 font-semibold">
                    Logado como {user?.name}
                  </div>
                  <Link to="/minha-conta" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700">Minha conta</Link>
                  <Link to="/meus-pedidos" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700">Meus pedidos</Link>
                  <Link to="/indique-ganhe" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-brand-main font-semibold">{settings?.referral_menu_label || 'Indique e ganhe benefícios'}</Link>
                  {isAdmin && <Link to="/backoffice" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-semibold text-gray-900">Painel Admin</Link>}
                  <button onClick={async () => { await logout(); setMobileOpen(false); navigate('/'); }} className="block w-full text-left px-3 py-2 text-sm text-red-500 font-medium">Sair da conta</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="text-center py-2 px-3 border border-border rounded-xl text-sm font-semibold">Entrar</Link>
                  <Link to="/cadastrar" onClick={() => setMobileOpen(false)} className="text-center py-2 px-3 bg-brand-main text-white rounded-xl text-sm font-semibold">Cadastrar</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* OVERLAY DE PESQUISA AVANÇADA */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-200"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-2xl w-full p-5 sm:p-6 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Formulário / Barra de Digitação */}
            <form onSubmit={executeFullSearch} className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-4 text-brand-main" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produtos, categorias, subcategorias ou palavras-chave..."
                className="w-full h-12 pl-12 pr-12 bg-bg-secondary/60 border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white focus:border-brand-main transition"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="absolute right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Painel de Resultados Dinâmicos */}
            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-4 pr-1">
              
              {searchLoading && (
                <div className="py-8 text-center text-txt-secondary flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-main" />
                  <span className="text-xs">Buscando em tempo real...</span>
                </div>
              )}

              {!searchLoading && searchTerm.trim() && (
                <>
                  {/* Seções de Categorias e Subcategorias encontradas */}
                  {(searchResults.categories.length > 0 || searchResults.subcategories.length > 0) && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary mb-2 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-brand-main" /> Categorias e Subcategorias
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.categories.map((c) => (
                          <Link
                            key={c.category_id}
                            to={`/categoria/${c.slug}`}
                            onClick={() => setSearchOpen(false)}
                            className="px-3 py-1.5 bg-orange-50 hover:bg-brand-main text-brand-main hover:text-white rounded-full text-xs font-semibold border border-orange-200 transition-colors"
                          >
                            Categoria: {c.name}
                          </Link>
                        ))}
                        {searchResults.subcategories.map((s) => (
                          <Link
                            key={s.subcategory_id}
                            to={`/subcategoria/${s.slug}`}
                            onClick={() => setSearchOpen(false)}
                            className="px-3 py-1.5 bg-gray-50 hover:border-brand-main text-gray-700 hover:text-brand-main rounded-full text-xs font-medium border border-gray-200 transition-colors"
                          >
                            {s.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Produtos encontrados */}
                  {searchResults.products.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary mb-2">
                        Produtos ({searchResults.products.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {searchResults.products.map((p) => {
                          const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;
                          const price = p.effective_price || p.price || 0;
                          return (
                            <Link
                              key={p.product_id}
                              to={`/produto/${p.product_id}`}
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 p-2 rounded-xl hover:bg-orange-50/50 border border-transparent hover:border-orange-100 transition group"
                            >
                              <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                                ) : (
                                  <Package className="w-6 h-6 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-brand-main">{p.name}</p>
                                <p className="text-[11px] text-txt-secondary truncate">{p.brand || p.category || 'OxxPharma'}</p>
                                <p className="text-xs font-bold text-brand-main font-mono">
                                  R$ {Number(price).toFixed(2)}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sem resultados */}
                  {searchResults.products.length === 0 &&
                    searchResults.categories.length === 0 &&
                    searchResults.subcategories.length === 0 && (
                      <div className="py-8 text-center text-txt-secondary">
                        <p className="text-sm">Nenhum resultado direto encontrado para "{searchTerm}".</p>
                        <p className="text-xs text-gray-400 mt-1">Tente palavras diferentes ou termos mais gerais.</p>
                      </div>
                  )}

                  {/* Botão de Ver todos os resultados */}
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={executeFullSearch}
                      className="w-full py-2.5 px-4 bg-orange-50 hover:bg-orange-100 text-brand-main font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                    >
                      <span>Ver catálogo completo de resultados para "{searchTerm}"</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {/* Estado Inicial (quando não digitou nada ainda) */}
              {!searchTerm.trim() && (
                <div className="py-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary mb-3">
                    Sugestões de busca em alta
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.slice(0, 6).map((c) => (
                      <button
                        key={c.category_id}
                        type="button"
                        onClick={() => {
                          setSearchTerm(c.name);
                        }}
                        className="px-3 py-1.5 bg-bg-secondary hover:bg-orange-50 hover:text-brand-main text-gray-700 rounded-full text-xs font-medium transition"
                      >
                        {c.name}
                      </button>
                    ))}
                    {['Imunidade', 'Sono', 'Suplementos', 'Emagrecimento', 'Dermocosméticos'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSearchTerm(tag)}
                        className="px-3 py-1.5 bg-bg-secondary hover:bg-orange-50 hover:text-brand-main text-gray-700 rounded-full text-xs font-medium transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
