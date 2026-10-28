import {
  // Entrega / Logística
  Truck, Package, Rocket, Box, MapPin, Store, Home,
  // Segurança / Confiança
  ShieldCheck, Shield, Lock, BadgeCheck, Award, Star, ThumbsUp,
  // Pagamento / Comercial
  CreditCard, DollarSign, Wallet, Banknote, Tag, Percent, Gift,
  // Tempo / Rapidez
  Clock, Zap, RefreshCcw,
  // Suporte / Comunicação
  Headphones, Phone, Users, BookOpen,
  // Saúde / Medicina
  Pill, Stethoscope, Activity, Heart, Syringe, Dna, Thermometer,
  // Bem-estar / Corpo / Fitness
  Flame, Scale, Dumbbell, Wind, Baby, Smile,
  // Beleza / Estética / Cuidado
  Sparkles, Droplets, Droplet, Scissors, Feather, Eye,
  // Mente / Sono / Energia
  Brain, Moon, Sun, Coffee,
  // Natureza / Nutrição
  Leaf, Apple,
  // Outros
  Layers, CheckCircle2,
} from 'lucide-react';

export const ICON_LIBRARY = {
  // Saúde & Medicina
  Pill, Stethoscope, Activity, Heart, Syringe, Dna, Thermometer,
  // Bem-estar & Corpo
  Flame, Scale, Dumbbell, Wind, Baby, Smile,
  // Beleza & Cuidados
  Sparkles, Droplets, Droplet, Scissors, Feather, Eye,
  // Mente, Sono & Energia
  Brain, Moon, Sun, Coffee, Zap,
  // Natureza & Nutrição
  Leaf, Apple,
  // Segurança & Qualidade
  ShieldCheck, Shield, Award, Star, BadgeCheck, ThumbsUp, Lock,
  // Logística & Pagamento
  Truck, Package, Box, MapPin, Store, Home, Rocket,
  CreditCard, DollarSign, Wallet, Banknote, Tag, Percent, Gift, Clock, RefreshCcw,
  // Geral
  Headphones, Phone, Users, BookOpen, Layers, CheckCircle2,
};

export const ICON_KEYS = Object.keys(ICON_LIBRARY);

export function getIcon(name) {
  return ICON_LIBRARY[name] || Sparkles;
}

export const ICON_CATEGORIES = [
  {
    id: 'saude',
    name: 'Saúde & Medicina',
    icons: ['Pill', 'Heart', 'Activity', 'Stethoscope', 'Syringe', 'Dna', 'Thermometer'],
  },
  {
    id: 'bem_estar',
    name: 'Corpo & Bem-estar',
    icons: ['Flame', 'Scale', 'Dumbbell', 'Wind', 'Baby', 'Smile'],
  },
  {
    id: 'beleza',
    name: 'Beleza & Cuidados',
    icons: ['Sparkles', 'Droplets', 'Droplet', 'Scissors', 'Feather', 'Eye'],
  },
  {
    id: 'mente_sono',
    name: 'Mente, Sono & Energia',
    icons: ['Brain', 'Moon', 'Sun', 'Coffee', 'Zap'],
  },
  {
    id: 'nutricao',
    name: 'Natureza & Nutrição',
    icons: ['Leaf', 'Apple'],
  },
  {
    id: 'qualidade',
    name: 'Qualidade & Confiança',
    icons: ['ShieldCheck', 'Shield', 'Award', 'Star', 'BadgeCheck', 'ThumbsUp'],
  },
  {
    id: 'comercial',
    name: 'Comércio & Entrega',
    icons: ['Truck', 'Package', 'Box', 'CreditCard', 'DollarSign', 'Tag', 'Percent', 'Clock', 'Gift'],
  },
];

export const ICON_LABELS = {
  Pill: 'Pílula / Medicamento',
  Heart: 'Coração / Vitalidade',
  Activity: 'Batimento / Disposição',
  Stethoscope: 'Estetoscópio',
  Syringe: 'Seringa / Aplicação',
  Dna: 'DNA / Genética',
  Thermometer: 'Termômetro',
  Flame: 'Fogo / Queima / Termogênico',
  Scale: 'Balança / Emagrecimento',
  Dumbbell: 'Haltere / Performance',
  Wind: 'Ar / Respiração / Ozônio',
  Baby: 'Bebê / Gestante / Infantil',
  Smile: 'Sorriso / Humor',
  Sparkles: 'Brilho / Pele / Beleza',
  Droplets: 'Gotas / Hidratação / Óleo',
  Droplet: 'Gota / Sérum',
  Scissors: 'Tesoura / Cabelo',
  Feather: 'Pena / Leveza',
  Eye: 'Olhos / Visão',
  Brain: 'Cérebro / Foco / Cognição',
  Moon: 'Lua / Sono / Relaxamento',
  Sun: 'Sol / Verão / Imunidade',
  Coffee: 'Café / Energia',
  Zap: 'Raio / Disposição',
  Leaf: 'Folha / Natural',
  Apple: 'Maçã / Nutrição / Intestino',
  ShieldCheck: 'Escudo verificado',
  Shield: 'Escudo / Imunidade',
  Award: 'Medalha / Reconhecimento',
  Star: 'Estrela / Destaque',
  BadgeCheck: 'Selo verificado',
  ThumbsUp: 'Curtida / Aprovado',
  Lock: 'Cadeado / Segurança',
  Truck: 'Caminhão de entrega',
  Package: 'Pacote / Caixa',
  Box: 'Caixa / Sticks',
  MapPin: 'Pino de mapa',
  Store: 'Loja física',
  Home: 'Casa',
  Rocket: 'Foguete',
  CreditCard: 'Cartão de crédito',
  DollarSign: 'Cifrão / Desconto',
  Wallet: 'Carteira',
  Banknote: 'Cédula',
  Tag: 'Etiqueta',
  Percent: 'Desconto (%)',
  Gift: 'Presente / Brinde',
  Clock: 'Relógio / Rapidez',
  RefreshCcw: 'Troca / Devolução',
  Headphones: 'Atendimento',
  Phone: 'Telefone',
  Users: 'Comunidade / Pessoas',
  BookOpen: 'Livro',
  Layers: 'Camadas / Protocolos',
  CheckCircle2: 'Check / Verificado',
};
