import {
  Truck, ShieldCheck, CreditCard, Package, Award, Clock, DollarSign,
  Headphones, Heart, Home, Leaf, Lock, MapPin, Phone, Pill, RefreshCcw,
  Rocket, Sparkles, Star, Tag, ThumbsUp, Zap, Gift, BadgeCheck, Percent,
  Box, Store, Wallet, BookOpen, Users, Stethoscope, Activity, Banknote,
} from 'lucide-react';

// Biblioteca de ícones disponível pra barra de benefícios (e onde mais quisermos).
// Chave é o identificador salvo no DB; value é o componente Lucide.
export const ICON_LIBRARY = {
  // Entrega / logística
  Truck, Package, Rocket, Box, MapPin, Store, Home,
  // Segurança / confiança
  ShieldCheck, Lock, BadgeCheck, Award, Star, ThumbsUp,
  // Pagamento / desconto
  CreditCard, DollarSign, Wallet, Banknote, Tag, Percent, Gift,
  // Tempo / rapidez
  Clock, Zap, RefreshCcw,
  // Suporte / saúde
  Headphones, Heart, Phone, Users, Stethoscope, Pill, Activity, Leaf,
  // Outros
  Sparkles, BookOpen,
};

export const ICON_KEYS = Object.keys(ICON_LIBRARY);

/**
 * Retorna o componente React do ícone pela string. Fallback em Truck.
 */
export function getIcon(name) {
  return ICON_LIBRARY[name] || Truck;
}

/**
 * Dicionário label-friendly para exibição no admin (seletor de ícone).
 */
export const ICON_LABELS = {
  Truck: 'Caminhão de entrega',
  Package: 'Pacote',
  Rocket: 'Foguete (rápido)',
  Box: 'Caixa',
  MapPin: 'Pino de mapa',
  Store: 'Loja física',
  Home: 'Casa',
  ShieldCheck: 'Escudo (segurança)',
  Lock: 'Cadeado',
  BadgeCheck: 'Selo verificado',
  Award: 'Medalha',
  Star: 'Estrela',
  ThumbsUp: 'Curtida',
  CreditCard: 'Cartão de crédito',
  DollarSign: 'Cifrão',
  Wallet: 'Carteira',
  Banknote: 'Cédula',
  Tag: 'Etiqueta',
  Percent: 'Desconto (%)',
  Gift: 'Presente',
  Clock: 'Relógio',
  Zap: 'Raio (rápido)',
  RefreshCcw: 'Troca/devolução',
  Headphones: 'Suporte/atendimento',
  Heart: 'Coração',
  Phone: 'Telefone',
  Users: 'Grupo/comunidade',
  Stethoscope: 'Estetoscópio',
  Pill: 'Remédio',
  Activity: 'Batimento cardíaco',
  Leaf: 'Folha (natural)',
  Sparkles: 'Brilhos (novidade)',
  BookOpen: 'Livro aberto',
};
