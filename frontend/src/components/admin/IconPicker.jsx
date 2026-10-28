import React, { useState, useRef } from 'react';
import {
  ICON_LIBRARY,
  ICON_CATEGORIES,
  ICON_LABELS,
  getIcon,
} from '../../lib/iconLibrary';
import { Button } from '../ui/Button';
import { Upload, X, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function IconPicker({
  value,
  svgValue,
  onChange,
  label = 'Ícone',
  helperText = 'Escolha um ícone da galeria ou faça upload de um arquivo SVG.',
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  // Ícone resolvido para exibição
  const CurrentIcon = getIcon(value || 'Sparkles');
  const hasValue = Boolean(value || svgValue);

  const handleSelectIcon = (key) => {
    onChange({ icon: key, icon_svg: null });
    setModalOpen(false);
  };

  const handleClear = () => {
    onChange({ icon: '', icon_svg: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      toast.error('Por favor, selecione um arquivo SVG (.svg)');
      return;
    }

    if (file.size > 500 * 1024) {
      toast.error('O arquivo SVG deve ter no máximo 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') {
        onChange({ icon: value || 'Sparkles', icon_svg: dataUrl });
        toast.success('Ícone SVG carregado com sucesso!');
      }
    };
    reader.onerror = () => {
      toast.error('Erro ao ler arquivo SVG');
    };
    reader.readAsDataURL(file);
  };

  // Filtragem de ícones para o modal
  const filteredCategories = ICON_CATEGORIES.map((cat) => {
    const icons = cat.icons.filter((k) => {
      if (activeCategory !== 'all' && cat.id !== activeCategory) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const lbl = (ICON_LABELS[k] || '').toLowerCase();
      return k.toLowerCase().includes(term) || lbl.includes(term);
    });
    return { ...cat, icons };
  }).filter((cat) => cat.icons.length > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-txt-primary">{label}</label>
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Remover ícone
          </button>
        )}
      </div>

      {helperText && <p className="text-xs text-txt-secondary">{helperText}</p>}

      <div className="flex items-center gap-4 p-3 bg-gray-50 border border-border rounded-xl">
        {/* Visual Preview */}
        <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center shrink-0 shadow-sm relative group">
          {svgValue ? (
            <img
              src={svgValue}
              alt="Ícone SVG"
              className="w-8 h-8 object-contain"
            />
          ) : (
            <CurrentIcon className="w-7 h-7 text-brand-main" />
          )}
        </div>

        {/* Info & Action Buttons */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-txt-primary truncate">
            {svgValue
              ? 'SVG Personalizado'
              : value
              ? `${ICON_LABELS[value] || value} (${value})`
              : 'Nenhum ícone selecionado (padrão ativo)'}
          </div>
          <div className="text-[11px] text-txt-secondary mt-0.5">
            {svgValue ? 'Arquivo vetorial SVG carregado' : 'Ícone da biblioteca da marca'}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="text-xs h-7 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-main" /> Galeria de Ícones
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-7 gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Fazer Upload SVG
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Modal Galeria de Ícones */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-heading font-black text-lg text-txt-primary">
                  Galeria de Ícones
                </h3>
                <p className="text-xs text-txt-secondary mt-0.5">
                  Selecione o ícone que melhor representa esta categoria.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 hover:bg-bg-secondary rounded-lg text-gray-500 hover:text-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Busca & Filtros por categoria */}
            <div className="p-4 border-b border-border space-y-3 shrink-0 bg-gray-50/60">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome do ícone (ex: sono, queima, remédio, beleza...)"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main"
                  autoFocus
                />
              </div>

              {/* Categorias Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
                    activeCategory === 'all'
                      ? 'bg-brand-main text-white'
                      : 'bg-white border border-border text-txt-secondary hover:text-txt-primary'
                  }`}
                >
                  Todos
                </button>
                {ICON_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
                      activeCategory === cat.id
                        ? 'bg-brand-main text-white'
                        : 'bg-white border border-border text-txt-secondary hover:text-txt-primary'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Ícones em Grade */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-12 text-txt-secondary text-xs">
                  Nenhum ícone encontrado para a pesquisa "{search}".
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <div key={cat.id} className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary">
                      {cat.name}
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {cat.icons.map((k) => {
                        const IconComponent = ICON_LIBRARY[k];
                        if (!IconComponent) return null;
                        const isSelected = value === k && !svgValue;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => handleSelectIcon(k)}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition hover:-translate-y-0.5 ${
                              isSelected
                                ? 'bg-orange-50 border-brand-main text-brand-main ring-2 ring-brand-main/30'
                                : 'bg-white border-border hover:border-brand-main/40 hover:bg-orange-50/30'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                              <IconComponent className="w-6 h-6 text-brand-main" />
                            </div>
                            <span className="text-[11px] font-bold text-txt-primary line-clamp-2 leading-tight">
                              {ICON_LABELS[k] || k}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border flex items-center justify-between shrink-0 bg-gray-50 text-xs text-txt-secondary">
              <span>{Object.keys(ICON_LIBRARY).length} ícones disponíveis</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
