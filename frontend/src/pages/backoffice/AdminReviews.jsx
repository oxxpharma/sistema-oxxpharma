import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Star,
  Check,
  X,
  Trash2,
  Search,
  Loader2,
  Clock,
  ShieldCheck,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../../components/admin/Pagination';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: '20',
      });
      if (search.trim()) params.append('search', search.trim());

      const data = await api.get(`/api/admin/reviews?${params.toString()}`);
      setReviews(data.reviews || []);
      setTotalPages(data.pages || 1);
      setStats({
        total: data.total || 0,
        pending: data.pending_count || 0,
        approved: data.approved_count || 0,
        rejected: data.rejected_count || 0,
      });
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar avaliações');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (reviewId, newStatus) => {
    setActionLoading(prev => ({ ...prev, [reviewId]: true }));
    try {
      await api.put(`/api/admin/reviews/${reviewId}/status`, { status: newStatus });
      toast.success(newStatus === 'approved' ? 'Avaliação aprovada e publicada!' : 'Avaliação rejeitada');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar status');
    } finally {
      setActionLoading(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta avaliação definitivamente?')) return;
    setActionLoading(prev => ({ ...prev, [reviewId]: true }));
    try {
      await api.delete(`/api/admin/reviews/${reviewId}`);
      toast.success('Avaliação excluída com sucesso');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir avaliação');
    } finally {
      setActionLoading(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  return (
    <div className="space-y-6 pb-16" data-testid="admin-reviews-page">
      {/* Topo / Título */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary flex items-center gap-2.5">
            <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
            Avaliações de Produtos
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            Moderação de depoimentos e notas (1 a 5 estrelas) enviadas por clientes.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RotateCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => { setStatusFilter('all'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'all'
              ? 'bg-brand-main text-white border-brand-main shadow-sm'
              : 'bg-white text-txt-primary border-border hover:border-brand-main/50'
          }`}
        >
          <div className={`text-xs uppercase font-bold tracking-wider mb-1 ${statusFilter === 'all' ? 'text-white/80' : 'text-txt-secondary'}`}>
            Total
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('pending'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all relative ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-txt-primary border-border hover:border-amber-400'
          }`}
        >
          {stats.pending > 0 && (
            <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          )}
          <div className={`text-xs uppercase font-bold tracking-wider mb-1 ${statusFilter === 'pending' ? 'text-white/90' : 'text-amber-600'}`}>
            Pendentes
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.pending}</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('approved'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'approved'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-txt-primary border-border hover:border-emerald-400'
          }`}
        >
          <div className={`text-xs uppercase font-bold tracking-wider mb-1 ${statusFilter === 'approved' ? 'text-white/90' : 'text-emerald-600'}`}>
            Aprovadas
          </div>
          <div className="text-2xl font-black text-emerald-600">{stats.approved}</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('rejected'); setPage(1); }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === 'rejected'
              ? 'bg-red-600 text-white border-red-600 shadow-sm'
              : 'bg-white text-txt-primary border-border hover:border-red-400'
          }`}
        >
          <div className={`text-xs uppercase font-bold tracking-wider mb-1 ${statusFilter === 'rejected' ? 'text-white/90' : 'text-red-500'}`}>
            Rejeitadas
          </div>
          <div className="text-2xl font-black text-red-500">{stats.rejected}</div>
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white rounded-2xl border border-border p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por produto, cliente, email ou trecho da avaliação..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm focus:outline-hidden focus:border-brand-main"
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'pending', 'approved', 'rejected'].map(st => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                statusFilter === st
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'all' ? 'Todas' : st === 'pending' ? 'Pendentes' : st === 'approved' ? 'Aprovadas' : 'Rejeitadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Avaliações */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-border">
          <Loader2 className="w-8 h-8 animate-spin text-brand-main mx-auto mb-2" />
          <p className="text-sm text-txt-secondary">Carregando avaliações...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-border">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-txt-primary">Nenhuma avaliação encontrada</h3>
          <p className="text-sm text-txt-secondary mt-1">
            {statusFilter === 'pending'
              ? 'Não há avaliações aguardando moderação.'
              : 'Nenhum resultado corresponde aos filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => {
            const isLoading = !!actionLoading[rev.review_id];
            return (
              <div
                key={rev.review_id}
                className={`bg-white rounded-2xl border p-5 transition shadow-xs ${
                  rev.status === 'pending'
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Info do Cliente e Produto */}
                  <div className="space-y-1.5 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-base text-txt-primary">{rev.user_name}</span>
                      {rev.user_email && (
                        <span className="text-xs text-txt-secondary">({rev.user_email})</span>
                      )}
                      {rev.verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> Compra verificada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-txt-secondary flex-wrap">
                      <span>Produto: <strong className="text-txt-primary">{rev.product_name}</strong></span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(rev.created_at)}
                      </span>
                      {rev.order_id && (
                        <>
                          <span>·</span>
                          <span>Pedido: <strong className="font-mono text-gray-700">#{rev.order_id}</strong></span>
                        </>
                      )}
                    </div>

                    {/* Estrelas */}
                    <div className="flex items-center gap-1 pt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= rev.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-700 ml-1.5">{rev.rating}/5</span>
                    </div>

                    {/* Comentário */}
                    <p className="text-sm text-gray-800 bg-gray-50/80 rounded-xl p-3 border border-gray-100 mt-2 italic leading-relaxed">
                      "{rev.comment}"
                    </p>
                  </div>

                  {/* Status e Ações */}
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div>
                      {rev.status === 'approved' && <Badge variant="success">Aprovada (Pública)</Badge>}
                      {rev.status === 'pending' && <Badge variant="brand">Aguardando Moderação</Badge>}
                      {rev.status === 'rejected' && <Badge variant="error">Rejeitada</Badge>}
                    </div>

                    <div className="flex items-center gap-2">
                      {rev.status !== 'approved' && (
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => updateStatus(rev.review_id, 'approved')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 gap-1.5 shadow-xs"
                          title="Aprovar e publicar na loja"
                        >
                          <Check className="w-3.5 h-3.5" /> Aprovar
                        </Button>
                      )}

                      {rev.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => updateStatus(rev.review_id, 'rejected')}
                          className="text-amber-700 hover:bg-amber-50 border-amber-200 text-xs h-8 px-3 gap-1.5"
                          title="Rejeitar avaliação"
                        >
                          <X className="w-3.5 h-3.5" /> Rejeitar
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isLoading}
                        onClick={() => deleteReview(rev.review_id)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-700 text-xs h-8 px-2"
                        title="Excluir definitivamente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <Pagination page={page} pages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
