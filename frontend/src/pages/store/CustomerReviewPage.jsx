import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Star, CheckCircle2, Loader2, ArrowLeft, PackageCheck, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerReviewPage() {
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState(null);
  
  // reviews state: { [productId]: { rating: number, comment: string, already_reviewed: boolean, submitted: boolean } }
  const [reviewsState, setReviewsState] = useState({});
  // loading state per product: { [productId]: boolean }
  const [submittingMap, setSubmittingMap] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (!orderId) {
          toast.error('Código do pedido não informado');
          return;
        }
        const data = await api.get(`/api/reviews/order/${orderId}`);
        setOrderInfo(data);

        // Preenche o estado inicial de cada produto
        const initial = {};
        (data.items || []).forEach(it => {
          initial[it.product_id] = {
            rating: it.existing_rating || 5,
            comment: it.existing_comment || '',
            already_reviewed: Boolean(it.already_reviewed),
            existing_status: it.existing_status,
            submitted: false,
          };
        });
        setReviewsState(initial);
      } catch (err) {
        toast.error('Pedido não encontrado ou link expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const handleRatingChange = (productId, rating) => {
    setReviewsState(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { comment: '', already_reviewed: false }),
        rating,
      }
    }));
  };

  const handleCommentChange = (productId, comment) => {
    setReviewsState(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { rating: 5, already_reviewed: false }),
        comment,
      }
    }));
  };

  const handleReviewSingleItem = async (e, item) => {
    e.preventDefault();
    const pid = item.product_id;
    const rev = reviewsState[pid] || { rating: 5, comment: '' };

    if (!rev.comment || !rev.comment.trim()) {
      toast.error('Por favor, escreva um pequeno relato sobre sua experiência com o produto.');
      return;
    }

    setSubmittingMap(prev => ({ ...prev, [pid]: true }));
    try {
      const res = await api.post(`/api/products/${pid}/reviews`, {
        rating: rev.rating || 5,
        comment: rev.comment.trim(),
        user_name: orderInfo.customer_name || 'Cliente OxxPharma',
        user_email: orderInfo.customer_email || '',
        order_id: orderId,
      });

      toast.success(res.message || 'Avaliação enviada com sucesso! Ficará visível após moderação.');
      
      setReviewsState(prev => ({
        ...prev,
        [pid]: {
          ...prev[pid],
          already_reviewed: true,
          submitted: true,
        }
      }));
    } catch (err) {
      toast.error(err.message || 'Erro ao enviar avaliação deste produto.');
    } finally {
      setSubmittingMap(prev => ({ ...prev, [pid]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-brand-main mb-4" />
        <p className="text-sm text-txt-secondary">Carregando produtos do seu pedido...</p>
      </div>
    );
  }

  if (!orderInfo || !orderInfo.items || orderInfo.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <PackageCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="font-heading font-black text-xl text-txt-primary mb-2">Pedido não localizado</h2>
        <p className="text-sm text-txt-secondary mb-6">Não encontramos os produtos correspondentes a este pedido.</p>
        <Link to="/" className="text-brand-main font-semibold text-sm hover:underline">
          Ir para a página inicial
        </Link>
      </div>
    );
  }

  const allReviewed = orderInfo.items.every(it => reviewsState[it.product_id]?.already_reviewed || reviewsState[it.product_id]?.submitted);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10" data-testid="customer-review-page">
      <div className="flex items-center justify-between mb-6">
        <Link to="/pedidos" className="inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-brand-main">
          <ArrowLeft className="w-4 h-4" /> Meus Pedidos
        </Link>
        <span className="text-xs text-txt-secondary font-mono">
          Pedido #{orderId.slice(-8).toUpperCase()}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 md:p-8 shadow-xs mb-8">
        <div className="flex items-center gap-3.5 mb-2">
          <span className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
            <Star className="w-7 h-7 fill-amber-500 text-amber-500" />
          </span>
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary">
              Avalie seus produtos
            </h1>
            <p className="text-xs text-txt-secondary mt-0.5">
              {orderInfo.customer_name ? `Olá, ${orderInfo.customer_name}!` : 'Olá!'} Avalie individualmente cada item adquirido na sua compra.
            </p>
          </div>
        </div>
        <p className="text-sm text-txt-secondary mt-3">
          Sua opinião é fundamental para outros clientes conhecerem os benefícios e resultados reais das nossas fórmulas.
        </p>

        {allReviewed && (
          <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Todos os itens deste pedido já receberam sua avaliação. Você pode atualizar seu depoimento a qualquer momento abaixo.
          </div>
        )}
      </div>

      <div className="space-y-6">
        {orderInfo.items.map((item, idx) => {
          const state = reviewsState[item.product_id] || { rating: 5, comment: '', already_reviewed: false, submitted: false };
          const isSubmitting = submittingMap[item.product_id] || false;
          const isDone = state.already_reviewed || state.submitted;

          return (
            <div
              key={item.product_id || idx}
              className={`bg-white rounded-2xl border transition p-6 shadow-xs ${
                isDone ? 'border-emerald-200 bg-emerald-50/20' : 'border-border'
              }`}
              data-testid={`review-card-${item.product_id}`}
            >
              <form onSubmit={(e) => handleReviewSingleItem(e, item)}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5 pb-4 border-b border-gray-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-xl bg-gray-50 border border-gray-100 shrink-0 mx-auto sm:mx-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 mx-auto sm:mx-0">
                      <Star className="w-7 h-7" />
                    </div>
                  )}

                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-between flex-wrap gap-2">
                      <h2 className="font-bold text-base text-txt-primary">{item.name}</h2>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          <Check className="w-3.5 h-3.5" /> Avaliado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-txt-secondary mt-1">
                      {isDone ? 'Sua avaliação para este item:' : 'Dê sua nota e conte sua experiência:'}
                    </p>
                  </div>
                </div>

                {/* Seletor de estrelas */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
                    Sua nota (1 a 5 estrelas)
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingChange(item.product_id, star)}
                        className="p-1 hover:scale-110 transition-transform focus:outline-hidden"
                        title={`${star} estrelas`}
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= (state.rating || 5)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300 hover:text-amber-200'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {state.rating === 5 ? '5/5 · Excelente' :
                       state.rating === 4 ? '4/5 · Muito bom' :
                       state.rating === 3 ? '3/5 · Bom' :
                       state.rating === 2 ? '2/5 · Regular' : '1/5 · Insatisfeito'}
                    </span>
                  </div>
                </div>

                {/* Comentário */}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
                    Seu depoimento sobre o produto*
                  </label>
                  <textarea
                    rows={3}
                    value={state.comment}
                    onChange={(e) => handleCommentChange(item.product_id, e.target.value)}
                    placeholder="Conte como tem sido sua experiência (resultados, sabor, textura, facilidade de uso, benefícios percebidos)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-hidden focus:border-brand-main focus:ring-1 focus:ring-brand-main bg-white"
                    required
                  />
                </div>

                {/* Botão de envio individual por item */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                  <div className="text-xs text-txt-secondary">
                    {isDone ? (
                      <span className="text-emerald-700 font-medium">✓ Avaliação gravada (visível no site após aprovação)</span>
                    ) : (
                      <span>Sua avaliação será revisada por nossa equipe antes de ser publicada.</span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    loading={isSubmitting}
                    className={`font-semibold shadow-xs ${
                      isDone
                        ? 'bg-gray-800 hover:bg-black text-white'
                        : 'bg-brand-main hover:bg-brand-main/90 text-white'
                    }`}
                  >
                    {isDone ? 'Atualizar Avaliação' : 'Enviar Avaliação deste Produto'}
                  </Button>
                </div>
              </form>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-gray-100 text-txt-primary hover:bg-gray-200 font-semibold text-sm transition"
        >
          Voltar para a página inicial
        </Link>
      </div>
    </div>
  );
}
