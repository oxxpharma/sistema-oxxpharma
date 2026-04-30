import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, Menu, X, LogOut, Package, MapPin, Share2, LayoutDashboard, Network } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useReferral } from '../../contexts/RefContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { Button } from '../ui/Button';
import BrandLogo from '../branding/BrandLogo';

export default function StoreHeader() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  // Mostra "Minha rede" só para usuarios que pertencem a alguma rede MMN
  // (network_1 corporativa, network_2 propagandista, ou admin pra inspeção).
  const networkType = user?.network_type;
  const showMyNetwork = isAuthenticated && (isAdmin || (networkType && networkType !== 'customer'));
  const { cart } = useCart();
  const { refName } = useReferral();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useSiteSettings();

  const onSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) navigate(`/buscar?q=${encodeURIComponent(searchTerm.trim())}`);
  };

  return (
    <header className="bg-white border-b border-border sticky top-0 z-40" data-testid="store-header">
      {settings?.announcement_bar_enabled && settings?.announcement_bar_text && (
        <a href={settings.announcement_bar_link || '#'}
          className="block text-center text-xs py-2 px-4 font-medium text-white"
          style={{ backgroundColor: settings.announcement_bar_bg_color || '#E8731A' }}
          data-testid="announcement-bar">
          {settings.announcement_bar_text}
        </a>
      )}
      {refName && (
        <div className="bg-brand-light text-brand-main text-center text-xs py-2 px-4 font-medium" data-testid="ref-banner">
          <Share2 className="w-3.5 h-3.5 inline mr-1.5" />
          Você está comprando através da indicação de <strong>{refName}</strong>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0" data-testid="logo-link">
            <BrandLogo slot="store_header" variant="light" textClassName="font-heading font-black text-xl text-txt-primary" />
          </Link>

          {/* Search */}
          <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-lg">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar produtos, categorias..."
                className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/20 focus:bg-white"
                data-testid="search-input"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-secondary transition"
                  data-testid="user-menu-btn"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-light text-brand-main flex items-center justify-center font-bold text-sm">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-txt-primary max-w-[120px] truncate">
                    {user?.name?.split(' ')[0]}
                  </span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-xl shadow-lg overflow-hidden" onMouseLeave={() => setMenuOpen(false)} data-testid="user-menu">
                    <Link to="/minha-conta" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-secondary" onClick={() => setMenuOpen(false)}>
                      <User className="w-4 h-4" /> Minha conta
                    </Link>
                    <Link to="/meus-pedidos" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-secondary" onClick={() => setMenuOpen(false)} data-testid="my-orders-link">
                      <Package className="w-4 h-4" /> Meus pedidos
                    </Link>
                    <Link to="/meus-enderecos" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-secondary" onClick={() => setMenuOpen(false)}>
                      <MapPin className="w-4 h-4" /> Endereços
                    </Link>
                    <Link to="/indique-ganhe" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-secondary text-brand-main font-semibold" onClick={() => setMenuOpen(false)} data-testid="referral-link">
                      <Share2 className="w-4 h-4" /> {settings?.referral_menu_label || 'Indique e ganhe benefícios'}
                    </Link>
                    {showMyNetwork && (
                      <Link to="/minha-rede" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-secondary" onClick={() => setMenuOpen(false)} data-testid="my-network-link">
                        <Network className="w-4 h-4" /> Minha Rede
                      </Link>
                    )}
                    {isAdmin && (
                      <Link to="/backoffice" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-secondary border-t border-border" onClick={() => setMenuOpen(false)} data-testid="backoffice-link">
                        <LayoutDashboard className="w-4 h-4" /> Painel Admin
                      </Link>
                    )}
                    <button
                      onClick={async () => { await logout(); setMenuOpen(false); navigate('/'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-secondary border-t border-border text-red-600"
                      data-testid="logout-btn"
                    >
                      <LogOut className="w-4 h-4" /> Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login"><Button variant="ghost" size="sm" data-testid="login-btn">Entrar</Button></Link>
                <Link to="/cadastrar"><Button size="sm" data-testid="register-btn">Cadastrar</Button></Link>
              </div>
            )}

            <Link to="/carrinho" className="relative p-2 rounded-lg hover:bg-bg-secondary transition" data-testid="cart-icon">
              <ShoppingCart className="w-5 h-5 text-txt-primary" />
              {cart.count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-brand-main text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center" data-testid="cart-count">
                  {cart.count}
                </span>
              )}
            </Link>

            <button className="md:hidden p-2 rounded-lg hover:bg-bg-secondary" onClick={() => setMobileOpen(!mobileOpen)} data-testid="mobile-menu-btn">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-border space-y-3">
            <form onSubmit={onSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full h-10 pl-10 pr-4 bg-bg-secondary border border-border rounded-full text-sm"
                />
              </div>
            </form>
            {isAuthenticated ? (
              <div className="space-y-1">
                <Link to="/minha-conta" className="block py-2 text-sm" onClick={() => setMobileOpen(false)}>Minha conta</Link>
                <Link to="/meus-pedidos" className="block py-2 text-sm" onClick={() => setMobileOpen(false)}>Meus pedidos</Link>
                <Link to="/indique-ganhe" className="block py-2 text-sm text-brand-main font-semibold" onClick={() => setMobileOpen(false)}>{settings?.referral_menu_label || 'Indique e ganhe benefícios'}</Link>
                {showMyNetwork && <Link to="/minha-rede" className="block py-2 text-sm" onClick={() => setMobileOpen(false)}>Minha Rede</Link>}
                {isAdmin && <Link to="/backoffice" className="block py-2 text-sm" onClick={() => setMobileOpen(false)}>Painel Admin</Link>}
                <button onClick={async () => { await logout(); setMobileOpen(false); navigate('/'); }} className="block w-full text-left py-2 text-sm text-red-600">Sair</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="flex-1"><Button variant="outline" className="w-full">Entrar</Button></Link>
                <Link to="/cadastrar" className="flex-1"><Button className="w-full">Cadastrar</Button></Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
