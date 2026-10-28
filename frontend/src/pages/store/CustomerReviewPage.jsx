import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Star, CheckCircle2, Loader2, ArrowLeft, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerReviewPage() {
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState(null);
  const [reviews, setReviews] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

        // Inicializa o estado para cada produto do pedido
        const initial = {};
        (data.items || []).forEach(it => {
          initial[it.product_id] = {
            rating: 5,
            comment: '',
          };
        });
        setReviews(initial);
      } catch (err) {
        toast.error('Pedido não encontrado ou link expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const handleRatingChange = (productId, rating) => {
    setReviews(prev => ({
      ...prev,
      [productId]: { ...prev[productId], rating }
    }));
  };

  const handleCommentChange = (productId, comment) => {
    setReviews(prev => ({
      ...prev,
      [productId]: { ...prev[productId], comment }
    }));
  };

  const handleSubmitAll = async (e) => {
    e.preventDefault();
    if (!orderInfo || !orderInfo.items) return;

    setSubmitting(true);
    try {
      let sentCount = 0;
      for (const item of orderInfo.items) {
        const rev = reviews[item.product_id];
        if (rev && rev.comment.trim()) {
          await api.post(`/api/products/${item.product_id}/reviews`, {
            rating: rev.rating || 5,
            comment: rev.comment.trim(),
            user_name: orderInfo.customer_name || 'Cliente OxxPharma',
            user_email: orderInfo.customer_email || '',
            order_id: orderId,
          });
          sentCount++;
        }
      }

      if (sentCount === 0) {
        toast.error('Por favor, escreva um comentário para ao menos um dos produtos.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      toast.success('Avaliações enviadas com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao enviar avaliação');
    } finally {
      setSubmitting(false);
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

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xs">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary mb-3">
          Muito obrigado pela sua avaliação!
        </h1>
        <p className="text-sm text-txt-secondary leading-relaxed mb-6">
          Sua opinião é fundamental para melhorarmos continuamente nossas fórmulas e ajuda outros clientes a fazerem as melhores escolhas.
          Sua avaliação foi enviada e será publicada após breve moderação.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-brand-main text-white font-semibold hover:bg-brand-main/90 transition shadow-sm text-sm"
        >
          Voltar para a Loja
        </Link>
      </div>
    );
  }

  if (!orderInfo || !orderInfo.items || orderInfo.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <PackageCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="font-heading font-black text-xl text-txt-primary mb-2">Pedido não localizado</h2>
        <p className="text-sm text-txt-secondary mb-6">Não encontramos os produtos correspondentes a este link.</p>
        <Link to="/" className="text-brand-main font-semibold text-sm hover:underline">
          Ir para a página inicial
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10" data-testid="customer-review-page">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-txt-secondary hover:text-brand-main mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar para a loja
      </Link>

      <div className="bg-white rounded-2xl border border-border p-6 md:p-8 shadow-xs mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
          </span>
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-txt-primary">
              Avalie seus produtos
            </h1>
            <p className="text-xs text-txt-secondary mt-0.5">
              Pedido <span className="font-mono font-bold text-gray-700">#{orderId}</span>
              {orderInfo.customer_name && ` · Olá, ${orderInfo.customer_name}`}
            </p>
          </div>
        </div>
        <p className="text-sm text-txt-secondary mt-3">
          Conte como está sendo sua experiência após os primeiros 15 dias de uso. Sua avaliação ajuda a comunidade OxxPharma!
        </p>
      </div>

      <form onSubmit={handleSubmitAll} className="space-y-6">
        {orderInfo.items.map((item, idx) => {
          const rev = reviews[item.product_id] || { rating: 5, comment: '' };
          return (
            <div
              key={item.product_id || idx}
              className="bg-white rounded-2xl border border-border p-6 shadow-xs"
            >
              <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-100">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-xl bg-gray-50 border border-gray-100 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    <Star className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h2 className="font-bold text-base text-txt-primary">{item.name}</h2>
                  <p className="text-xs text-txt-secondary">Como você avalia este produto?</p>
                </div>
              </div>

              {/* Seletor de estrelas */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
                  Sua nota (1 a 5 estrelas)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange(item.product_id, star)}
                      className="p-1 hover:scale-110 transition-transform"
                      title={`${star} estrelas`}
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= rev.rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-3 text-sm font-bold text-amber-600">
                    {rev.rating === 5 ? 'Excelente (5/5)' :
                     rev.rating === 4 ? 'Muito bom (4/5)' :
                     rev.rating === 3 ? 'Bom (3/5)' :
                     rev.rating === 2 ? 'Regular (2/5)' : 'Insatisfeito (1/5)'}
                  </span>
                </div>
              </div>

              {/* Comentário */}
              <div>
                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-2">
                  Seu depoimento sobre o produto*
                </label>
                <textarea
                  rows={3}
                  value={rev.comment}
                  onChange={(e) => handleCommentChange(item.product_id, e.target.value)}
                  placeholder="Ex: Estou sentindo muita diferença na minha disposição diária. A entrega foi rápida e o produto é de excelente qualidade..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:outline-hidden focus:border-brand-main focus:ring-1 focus:ring-brand-main"
                  required
                />
              </div>
            </div>
          );
        })}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            loading={submitting}
            className="px-8 py-3 text-base font-bold shadow-md"
            data-testid="submit-reviews-btn"
          >
            Enviar Minha Avaliação
          </Button>
        </div>
      </form>
    </div>
  );
}
