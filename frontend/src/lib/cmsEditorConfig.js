/**
 * cmsEditorConfig.js - Configurações completas para o Editor Visual de Páginas (CMS) da OxxPharma
 * Inclui:
 * - Fontes oficiais: Anona (Títulos), Tosh A (Serifada Elegante), Montserrat, IBM Plex Sans, Inter
 * - Style Manager avançado com paleta de cores OxxPharma (#E8731A, etc.), tipografia, fundos e espaçamentos
 * - Biblioteca completa de blocos pré-construídos para páginas informativas
 */

export const CMS_FONTS_CSS = `
/* --- Fontes Oficiais OxxPharma --- */
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-Thin.otf') format('opentype');
  font-weight: 100;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-Light.otf') format('opentype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-Medium.otf') format('opentype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-SemiBold.otf') format('opentype');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-Bold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-ExtraBold.otf') format('opentype');
  font-weight: 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Anona';
  src: url('/fonts/Anona-Black.otf') format('opentype');
  font-weight: 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Tosh A';
  src: url('/fonts/ToshA-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Tosh A';
  src: url('/fonts/ToshA-Medium.otf') format('opentype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Tosh A';
  src: url('/fonts/ToshA-Bold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Base Styles do Canvas */
body {
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
  margin: 0;
  padding: 0;
  background-color: #ffffff;
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
}

* {
  box-sizing: border-box;
}

/* Helpers */
.font-anona { font-family: 'Anona', sans-serif !important; }
.font-tosh { font-family: 'Tosh A', Georgia, serif !important; }
.font-montserrat { font-family: 'Montserrat', sans-serif !important; }
.font-plex { font-family: 'IBM Plex Sans', sans-serif !important; }

/* Transições suaves */
a, button {
  transition: all 0.2s ease-in-out;
}
`;

export const CMS_STYLE_MANAGER_SECTORS = [
  {
    name: 'Tipografia',
    open: true,
    buildProps: [
      'font-family',
      'font-size',
      'font-weight',
      'color',
      'line-height',
      'letter-spacing',
      'text-align',
      'text-decoration',
      'text-transform',
    ],
    properties: [
      {
        property: 'font-family',
        name: 'Família da Fonte',
        defaults: "'IBM Plex Sans', sans-serif",
        options: [
          { id: "'Anona', sans-serif", label: 'Anona (Títulos OxxPharma)' },
          { id: "'Tosh A', Georgia, serif", label: 'Tosh A (Serifada Elegante)' },
          { id: "'Montserrat', sans-serif", label: 'Montserrat (Moderna)' },
          { id: "'IBM Plex Sans', sans-serif", label: 'IBM Plex Sans (Texto Padrão)' },
          { id: "'Inter', sans-serif", label: 'Inter' },
          { id: 'Arial, sans-serif', label: 'Arial' },
          { id: 'Georgia, serif', label: 'Georgia' },
        ],
      },
      {
        property: 'font-size',
        name: 'Tamanho da Fonte',
        defaults: '16px',
        options: [
          { id: '12px', label: '12px (Micro)' },
          { id: '14px', label: '14px (Pequeno)' },
          { id: '16px', label: '16px (Normal / Padrão)' },
          { id: '18px', label: '18px (Destaque Leve)' },
          { id: '20px', label: '20px (Título Pequeno / H4)' },
          { id: '24px', label: '24px (Subtítulo / H3)' },
          { id: '28px', label: '28px (Título Médio / H2)' },
          { id: '32px', label: '32px (Título Grande)' },
          { id: '36px', label: '36px (Destaque Alto)' },
          { id: '42px', label: '42px (Hero / H1)' },
          { id: '48px', label: '48px (Hero Grande)' },
          { id: '56px', label: '56px (Banner Máximo)' },
        ],
      },
      {
        property: 'font-weight',
        name: 'Peso da Fonte',
        options: [
          { id: '100', label: '100 - Extra Fina (Thin)' },
          { id: '300', label: '300 - Leve (Light)' },
          { id: '400', label: '400 - Normal (Regular)' },
          { id: '500', label: '500 - Médio (Medium)' },
          { id: '600', label: '600 - Seminegrito (SemiBold)' },
          { id: '700', label: '700 - Negrito (Bold)' },
          { id: '800', label: '800 - Extra Negrito (ExtraBold)' },
          { id: '900', label: '900 - Forte (Black)' },
        ],
      },
      {
        property: 'color',
        name: 'Cor do Texto',
        type: 'color',
        defaults: '#1E293B',
      },
      {
        property: 'text-align',
        name: 'Alinhamento',
        type: 'radio',
        defaults: 'left',
        options: [
          { id: 'left', label: 'Esq' },
          { id: 'center', label: 'Centro' },
          { id: 'right', label: 'Dir' },
          { id: 'justify', label: 'Just' },
        ],
      },
    ],
  },
  {
    name: 'Dimensões & Espaçamento',
    open: false,
    buildProps: ['max-width', 'width', 'min-height', 'margin', 'padding'],
    properties: [
      {
        property: 'max-width',
        name: 'Largura Máxima',
        options: [
          { id: 'none', label: 'Sem limite (100%)' },
          { id: '1200px', label: '1200px (Largo)' },
          { id: '1100px', label: '1100px (Padrão OxxPharma)' },
          { id: '900px', label: '900px (Médio)' },
          { id: '800px', label: '800px (Texto/Artigo Leitura)' },
          { id: '600px', label: '600px (Estreito / Formulário)' },
        ],
      },
      { property: 'margin', name: 'Margem Externa (Margin)' },
      { property: 'padding', name: 'Margem Interna (Padding)' },
    ],
  },
  {
    name: 'Cores & Fundo',
    open: false,
    buildProps: ['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat'],
    properties: [
      {
        property: 'background-color',
        name: 'Cor de Fundo',
        type: 'color',
        defaults: '#FFFFFF',
      },
    ],
  },
  {
    name: 'Bordas & Cantos',
    open: false,
    buildProps: ['border-radius', 'border-width', 'border-style', 'border-color', 'box-shadow'],
    properties: [
      {
        property: 'border-radius',
        name: 'Cantos Arredondados',
        options: [
          { id: '0px', label: '0px (Reto)' },
          { id: '6px', label: '6px (Sutil)' },
          { id: '10px', label: '10px (Padrão)' },
          { id: '14px', label: '14px (Médio)' },
          { id: '20px', label: '20px (Grande)' },
          { id: '9999px', label: 'Pílula / Redondo' },
        ],
      },
      {
        property: 'border-color',
        name: 'Cor da Borda',
        type: 'color',
      },
    ],
  },
  {
    name: 'Disposição (Flexbox)',
    open: false,
    buildProps: ['display', 'flex-direction', 'justify-content', 'align-items', 'gap'],
    properties: [
      {
        property: 'display',
        name: 'Modo de Exibição',
        type: 'select',
        options: [
          { id: 'block', label: 'Bloco (Block)' },
          { id: 'flex', label: 'Flexível (Flexbox)' },
          { id: 'grid', label: 'Grade (Grid)' },
          { id: 'inline-block', label: 'Inline-Block' },
          { id: 'none', label: 'Oculto (None)' },
        ],
      },
    ],
  },
];

/**
 * Registra todos os blocos informativos customizados no GrapesJS BlockManager
 */
export function registerCmsBlocks(editor) {
  const bm = editor.BlockManager;

  // 1. ESTRUTURA & LAYOUT
  bm.add('cms-container', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-square-o" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Container Centralizado</div>
      </div>
    `,
    category: 'Estrutura & Layout',
    content: `
      <div class="cms-container" style="max-width: 1100px; margin: 0 auto; padding: 40px 20px; box-sizing: border-box; width: 100%;">
        <p style="text-align: center; color: #94A3B8; font-size: 13px; font-style: italic;">[Container Centralizado - Insira seus blocos aqui dentro]</p>
      </div>
    `,
  });

  bm.add('cms-2-columns', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-columns" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">2 Colunas (50/50)</div>
      </div>
    `,
    category: 'Estrutura & Layout',
    content: `
      <div style="display: flex; flex-wrap: wrap; gap: 32px; max-width: 1100px; margin: 28px auto; padding: 0 20px; box-sizing: border-box;">
        <div style="flex: 1 1 320px; min-width: 280px; box-sizing: border-box;">
          <h3 style="font-family: 'Anona', sans-serif; font-size: 22px; font-weight: 700; color: #1E293B; margin-top: 0; margin-bottom: 12px;">Coluna 1</h3>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; color: #475569; line-height: 1.7; margin: 0;">Insira seu texto, imagem ou conteúdo explicativo nesta coluna.</p>
        </div>
        <div style="flex: 1 1 320px; min-width: 280px; box-sizing: border-box;">
          <h3 style="font-family: 'Anona', sans-serif; font-size: 22px; font-weight: 700; color: #1E293B; margin-top: 0; margin-bottom: 12px;">Coluna 2</h3>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; color: #475569; line-height: 1.7; margin: 0;">Insira seu texto, imagem ou conteúdo explicativo nesta coluna.</p>
        </div>
      </div>
    `,
  });

  bm.add('cms-2-columns-asym', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-th-large" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">2 Colunas (60/40)</div>
      </div>
    `,
    category: 'Estrutura & Layout',
    content: `
      <div style="display: flex; flex-wrap: wrap; gap: 36px; max-width: 1100px; margin: 36px auto; padding: 0 20px; align-items: center; box-sizing: border-box;">
        <div style="flex: 1.5 1 340px; box-sizing: border-box;">
          <span style="display: inline-block; background: #FFEDD5; color: #C25E0E; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">Destaque</span>
          <h2 style="font-family: 'Anona', sans-serif; font-size: 32px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; line-height: 1.25;">Conteúdo Principal com Mais Espaço</h2>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 16px; color: #475569; line-height: 1.75; margin-bottom: 20px;">Utilize esta coluna maior para o texto explicativo detalhado, políticas ou apresentação de produtos da farmácia.</p>
          <a href="/loja" style="display: inline-block; background: #E8731A; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 10px;">Saiba mais</a>
        </div>
        <div style="flex: 1 1 280px; box-sizing: border-box;">
          <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80" alt="Imagem Ilustrativa" style="width: 100%; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); object-fit: cover; display: block;" />
        </div>
      </div>
    `,
  });

  bm.add('cms-3-columns', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-th" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">3 Colunas (33/33/33)</div>
      </div>
    `,
    category: 'Estrutura & Layout',
    content: `
      <div style="display: flex; flex-wrap: wrap; gap: 24px; max-width: 1100px; margin: 32px auto; padding: 0 20px; box-sizing: border-box;">
        <div style="flex: 1 1 280px; box-sizing: border-box; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 24px;">
          <h4 style="font-family: 'Anona', sans-serif; font-size: 18px; font-weight: 700; color: #1E293B; margin-top: 0; margin-bottom: 10px;">Tópico 1</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Descrição do primeiro ponto ou benefício.</p>
        </div>
        <div style="flex: 1 1 280px; box-sizing: border-box; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 24px;">
          <h4 style="font-family: 'Anona', sans-serif; font-size: 18px; font-weight: 700; color: #1E293B; margin-top: 0; margin-bottom: 10px;">Tópico 2</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Descrição do segundo ponto ou benefício.</p>
        </div>
        <div style="flex: 1 1 280px; box-sizing: border-box; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 24px;">
          <h4 style="font-family: 'Anona', sans-serif; font-size: 18px; font-weight: 700; color: #1E293B; margin-top: 0; margin-bottom: 10px;">Tópico 3</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Descrição do terceiro ponto ou benefício.</p>
        </div>
      </div>
    `,
  });

  bm.add('cms-divider', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-minus" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Divisor OxxPharma</div>
      </div>
    `,
    category: 'Estrutura & Layout',
    content: `
      <div style="max-width: 1100px; margin: 40px auto; padding: 0 20px; display: flex; align-items: center; justify-content: center; gap: 16px;">
        <div style="flex: 1; height: 1px; background: #E2E8F0;"></div>
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #E8731A;"></div>
        <div style="flex: 1; height: 1px; background: #E2E8F0;"></div>
      </div>
    `,
  });

  bm.add('cms-spacer', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-arrows-v" style="font-size:20px;color:#94A3B8;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Espaço Vertical</div>
      </div>
    `,
    category: 'Estrutura & Layout',
    content: `<div style="height: 48px; width: 100%;"></div>`,
  });

  // 2. CABEÇALHOS & TÍTULOS
  bm.add('cms-hero-banner', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-bullhorn" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Hero Informativo</div>
      </div>
    `,
    category: 'Cabeçalhos & Títulos',
    content: `
      <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%); border-bottom: 1px solid #FED7AA; padding: 60px 20px; text-align: center; margin-bottom: 40px;">
        <div style="max-width: 800px; margin: 0 auto;">
          <span style="display: inline-block; background: #FFEDD5; color: #C25E0E; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 16px; border-radius: 9999px; margin-bottom: 16px; border: 1px solid #FED7AA;">INFORMAÇÕES OFICIAIS</span>
          <h1 style="font-family: 'Anona', sans-serif; font-size: 42px; font-weight: 800; color: #1E293B; margin: 0 0 16px 0; line-height: 1.2;">Título da Página Informativa</h1>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 18px; color: #64748B; line-height: 1.6; margin: 0 0 24px 0;">Aqui você encontra todos os detalhes, procedimentos e orientações da OxxPharma Magistral com transparência e clareza.</p>
          <a href="/loja" style="display: inline-block; background: #E8731A; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 700; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 14px rgba(232, 115, 26, 0.3);">Conhecer a Farmácia</a>
        </div>
      </div>
    `,
  });

  bm.add('cms-title-eyebrow', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-header" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Título com Tag Eyebrow</div>
      </div>
    `,
    category: 'Cabeçalhos & Títulos',
    content: `
      <div style="max-width: 1100px; margin: 36px auto 20px; padding: 0 20px;">
        <span style="color: #E8731A; font-family: 'Anona', sans-serif; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">OXXPHARMA MAGISTRAL</span>
        <h2 style="font-family: 'Anona', sans-serif; font-size: 32px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0; line-height: 1.25;">Encontre o <span style="color: #E8731A;">cuidado</span> que faz sentido para você</h2>
        <div style="width: 48px; height: 3px; background: #E8731A; border-radius: 2px; margin-bottom: 12px;"></div>
        <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 16px; color: #64748B; line-height: 1.6; margin: 0;">Soluções personalizadas para diferentes momentos, necessidades e objetivos.</p>
      </div>
    `,
  });

  bm.add('cms-title-tosh', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-font" style="font-size:20px;color:#334155;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Título Elegante (Tosh A)</div>
      </div>
    `,
    category: 'Cabeçalhos & Títulos',
    content: `
      <div style="max-width: 900px; margin: 36px auto; padding: 0 20px; text-align: center;">
        <h2 style="font-family: 'Tosh A', Georgia, serif; font-size: 36px; font-weight: 700; font-style: italic; color: #1E293B; margin: 0 0 12px 0;">Compromisso com a sua saúde e bem-estar</h2>
        <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 16px; color: #64748B; line-height: 1.6; margin: 0;">Mais de 25 anos de dedicação à farmácia magistral e qualidade comprovada.</p>
      </div>
    `,
  });

  // 3. CONTEÚDO & TEXTOS
  bm.add('cms-paragraph', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-paragraph" style="font-size:20px;color:#64748B;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Artigo / Parágrafo</div>
      </div>
    `,
    category: 'Conteúdo & Textos',
    content: `
      <div style="max-width: 800px; margin: 24px auto; padding: 0 20px; font-family: 'IBM Plex Sans', sans-serif; color: #334155; font-size: 16px; line-height: 1.85;">
        <p style="margin-bottom: 18px;">A OxxPharma atua no mercado de manipulação magistral trazendo inovação em formulações ozonizadas, suplementação personalizada e produtos para a qualidade de vida. Cada composto é preparado seguindo rígidos protocolos de qualidade e segurança.</p>
        <p style="margin-bottom: 18px;">Nosso laboratório conta com farmacêuticos especializados, equipamentos modernos e matérias-primas com laudos de pureza certificados pelos órgãos regulatórios nacionais.</p>
      </div>
    `,
  });

  bm.add('cms-callout-warning', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-exclamation-triangle" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Caixa de Alerta (Aviso)</div>
      </div>
    `,
    category: 'Conteúdo & Textos',
    content: `
      <div style="max-width: 900px; margin: 24px auto; padding: 20px 24px; background: #FFF7ED; border-left: 4px solid #E8731A; border-radius: 12px; box-sizing: border-box;">
        <div style="display: flex; align-items: flex-start; gap: 14px;">
          <div style="font-size: 24px; line-height: 1; color: #E8731A;">⚠️</div>
          <div>
            <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #9A3412; margin: 0 0 6px 0;">Aviso Importante</h4>
            <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #7C2D12; line-height: 1.6; margin: 0;">Para pedidos com entrega no mesmo dia, a confirmação do pagamento deve ocorrer até as 13h em dias úteis. Medicamentos controlados exigem envio prévio da receita médica original.</p>
          </div>
        </div>
      </div>
    `,
  });

  bm.add('cms-callout-success', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-check-circle" style="font-size:20px;color:#10B981;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Caixa de Garantia (Verde)</div>
      </div>
    `,
    category: 'Conteúdo & Textos',
    content: `
      <div style="max-width: 900px; margin: 24px auto; padding: 20px 24px; background: #F0FDF4; border-left: 4px solid #10B981; border-radius: 12px; box-sizing: border-box;">
        <div style="display: flex; align-items: flex-start; gap: 14px;">
          <div style="font-size: 24px; line-height: 1; color: #10B981;">🛡️</div>
          <div>
            <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #065F46; margin: 0 0 6px 0;">Garantia de Qualidade & Procedência</h4>
            <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #047857; line-height: 1.6; margin: 0;">Todos os lotes possuem rastreabilidade completa desde a entrada da matéria-prima até a embalagem final, com certificação ANVISA e CRF.</p>
          </div>
        </div>
      </div>
    `,
  });

  bm.add('cms-blockquote', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-quote-left" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Citação (Blockquote)</div>
      </div>
    `,
    category: 'Conteúdo & Textos',
    content: `
      <div style="max-width: 800px; margin: 32px auto; padding: 24px 32px; background: #F8FAFC; border-left: 4px solid #E8731A; border-radius: 0 16px 16px 0;">
        <p style="font-family: 'Tosh A', Georgia, serif; font-size: 20px; font-style: italic; color: #1E293B; line-height: 1.6; margin: 0 0 12px 0;">"Cuidar da saúde não é apenas tratar sintomas, mas proporcionar equilíbrio e longevidade através de ciência e inovação constante."</p>
        <span style="font-family: 'Anona', sans-serif; font-size: 13px; font-weight: 700; color: #E8731A; text-transform: uppercase; letter-spacing: 1px;">— Farmacêutico Responsável</span>
      </div>
    `,
  });

  bm.add('cms-checklist', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-list-ul" style="font-size:20px;color:#10B981;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Lista com Checkmarks</div>
      </div>
    `,
    category: 'Conteúdo & Textos',
    content: `
      <div style="max-width: 800px; margin: 24px auto; padding: 0 20px;">
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; color: #334155;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #DCFCE7; color: #16A34A; font-weight: bold; font-size: 12px; flex-shrink: 0;">✓</span>
            <span>Atendimento farmacêutico humanizado e suporte direto por WhatsApp</span>
          </li>
          <li style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; color: #334155;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #DCFCE7; color: #16A34A; font-weight: bold; font-size: 12px; flex-shrink: 0;">✓</span>
            <span>Entrega expressa e embalagem com controle de temperatura se necessário</span>
          </li>
          <li style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; color: #334155;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #DCFCE7; color: #16A34A; font-weight: bold; font-size: 12px; flex-shrink: 0;">✓</span>
            <span>Matérias-primas puras e laudos analíticos emitidos por lote</span>
          </li>
        </ul>
      </div>
    `,
  });

  // 4. CARDS & COLUNAS INFORMATIVAS
  bm.add('cms-3-cards-icons', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-id-card-o" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Grade de 3 Cards</div>
      </div>
    `,
    category: 'Cards & Colunas',
    content: `
      <div style="display: flex; flex-wrap: wrap; gap: 24px; max-width: 1100px; margin: 36px auto; padding: 0 20px; box-sizing: border-box;">
        <div style="flex: 1 1 280px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px 24px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.04); box-sizing: border-box;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #FFF7ED; color: #E8731A; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px;">🔬</div>
          <h3 style="font-family: 'Anona', sans-serif; font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 10px 0;">Tecnologia & Inovação</h3>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Pesquisa constante e equipamentos de ponta para fórmulas eficientes e estáveis.</p>
        </div>
        <div style="flex: 1 1 280px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px 24px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.04); box-sizing: border-box;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #FFF7ED; color: #E8731A; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px;">🛡️</div>
          <h3 style="font-family: 'Anona', sans-serif; font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 10px 0;">Segurança & Rigor</h3>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Controle analítico absoluto de cada ingrediente utilizado em nosso laboratório.</p>
        </div>
        <div style="flex: 1 1 280px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px 24px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.04); box-sizing: border-box;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #FFF7ED; color: #E8731A; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px;">🌱</div>
          <h3 style="font-family: 'Anona', sans-serif; font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 10px 0;">Cuidado Integral</h3>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Foco na saúde global e bem-estar preventivo de cada um de nossos pacientes.</p>
        </div>
      </div>
    `,
  });

  bm.add('cms-steps-process', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-sort-numeric-asc" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Passo a Passo (1, 2, 3)</div>
      </div>
    `,
    category: 'Cards & Colunas',
    content: `
      <div style="display: flex; flex-wrap: wrap; gap: 20px; max-width: 1000px; margin: 36px auto; padding: 0 20px; box-sizing: border-box;">
        <div style="flex: 1 1 260px; background: #FFFFFF; border: 1px solid #FED7AA; border-radius: 14px; padding: 24px; box-sizing: border-box;">
          <span style="width: 32px; height: 32px; border-radius: 50%; background: #E8731A; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 800; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">1</span>
          <h4 style="font-family: 'Anona', sans-serif; font-size: 17px; font-weight: 700; color: #1E293B; margin: 0 0 8px 0;">Envie sua Receita</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.5; margin: 0;">Faça o upload do documento médico ou prescrição pelo site ou pelo WhatsApp.</p>
        </div>
        <div style="flex: 1 1 260px; background: #FFFFFF; border: 1px solid #FED7AA; border-radius: 14px; padding: 24px; box-sizing: border-box;">
          <span style="width: 32px; height: 32px; border-radius: 50%; background: #E8731A; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 800; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">2</span>
          <h4 style="font-family: 'Anona', sans-serif; font-size: 17px; font-weight: 700; color: #1E293B; margin: 0 0 8px 0;">Avaliação Farmacêutica</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.5; margin: 0;">Nossa equipe técnica valida a dosagem e prepara a cotação em minutos.</p>
        </div>
        <div style="flex: 1 1 260px; background: #FFFFFF; border: 1px solid #FED7AA; border-radius: 14px; padding: 24px; box-sizing: border-box;">
          <span style="width: 32px; height: 32px; border-radius: 50%; background: #E8731A; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 800; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">3</span>
          <h4 style="font-family: 'Anona', sans-serif; font-size: 17px; font-weight: 700; color: #1E293B; margin: 0 0 8px 0;">Receba em Casa</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.5; margin: 0;">Manipulação rápida e entrega expressa com embalagem segura.</p>
        </div>
      </div>
    `,
  });

  // 5. BOTÕES & CHAMADAS
  bm.add('cms-btn-primary', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-hand-pointer-o" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Botão Laranja OxxPharma</div>
      </div>
    `,
    category: 'Botões & Chamadas',
    content: `
      <div style="text-align: center; margin: 24px 0;">
        <a href="/loja" style="display: inline-block; background: #E8731A; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(232, 115, 26, 0.28);">Conhecer Produtos</a>
      </div>
    `,
  });

  bm.add('cms-btn-outline', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-square-o" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Botão Contorno (Outline)</div>
      </div>
    `,
    category: 'Botões & Chamadas',
    content: `
      <div style="text-align: center; margin: 24px 0;">
        <a href="/contato" style="display: inline-block; background: transparent; color: #E8731A; border: 2px solid #E8731A; font-family: 'Anona', sans-serif; font-weight: 700; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 12px;">Fale Conosco</a>
      </div>
    `,
  });

  bm.add('cms-btn-whatsapp', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-whatsapp" style="font-size:20px;color:#25D366;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Botão WhatsApp</div>
      </div>
    `,
    category: 'Botões & Chamadas',
    content: `
      <div style="text-align: center; margin: 24px 0;">
        <a href="https://wa.me/5544997662565" target="_blank" style="display: inline-flex; align-items: center; gap: 10px; background: #25D366; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.3);">
          <span style="font-size: 18px;">💬</span> Conversar no WhatsApp
        </a>
      </div>
    `,
  });

  bm.add('cms-cta-banner', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-envelope-open-o" style="font-size:20px;color:#0F172A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Faixa CTA Informativa</div>
      </div>
    `,
    category: 'Botões & Chamadas',
    content: `
      <div style="background: #1E293B; border-radius: 16px; max-width: 1000px; margin: 40px auto; padding: 36px 32px; color: #FFFFFF; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; box-sizing: border-box;">
        <div>
          <h3 style="font-family: 'Anona', sans-serif; font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #FFFFFF;">Ficou com alguma dúvida específica?</h3>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; color: #94A3B8; margin: 0;">Nossa equipe farmacêutica está disponível para esclarecer suas perguntas em tempo real.</p>
        </div>
        <a href="/contato" style="display: inline-block; background: #E8731A; color: #FFFFFF; font-family: 'Anona', sans-serif; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 30px; border-radius: 12px; white-space: nowrap;">Entrar em Contato</a>
      </div>
    `,
  });

  // 6. MÍDIA & IMAGENS
  bm.add('cms-image-caption', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-picture-o" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Imagem com Legenda</div>
      </div>
    `,
    category: 'Mídia & Imagens',
    content: `
      <div style="max-width: 800px; margin: 28px auto; text-align: center; padding: 0 20px;">
        <img src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1000&auto=format&fit=crop&q=80" alt="Instalações OxxPharma" style="width: 100%; border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.08); display: block;" />
        <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; color: #94A3B8; margin-top: 10px; font-style: italic;">Laboratório de manipulação magistral OxxPharma com controle de esterilidade e pureza.</p>
      </div>
    `,
  });

  bm.add('cms-2-images-grid', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-th-large" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Grade de 2 Fotos</div>
      </div>
    `,
    category: 'Mídia & Imagens',
    content: `
      <div style="display: flex; flex-wrap: wrap; gap: 20px; max-width: 1000px; margin: 32px auto; padding: 0 20px; box-sizing: border-box;">
        <div style="flex: 1 1 300px;">
          <img src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80" alt="Foto 1" style="width: 100%; height: 260px; object-fit: cover; border-radius: 14px; display: block;" />
        </div>
        <div style="flex: 1 1 300px;">
          <img src="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&auto=format&fit=crop&q=80" alt="Foto 2" style="width: 100%; height: 260px; object-fit: cover; border-radius: 14px; display: block;" />
        </div>
      </div>
    `,
  });

  // 7. ATENDIMENTO & FAQ
  bm.add('cms-contact-channels', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-phone" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Canais de Atendimento</div>
      </div>
    `,
    category: 'Atendimento & FAQ',
    content: `
      <div style="display: flex; flex-wrap: wrap; gap: 20px; max-width: 1000px; margin: 36px auto; padding: 0 20px; box-sizing: border-box;">
        <div style="flex: 1 1 280px; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 14px; padding: 24px; box-sizing: border-box;">
          <div style="font-size: 26px; margin-bottom: 8px;">📞</div>
          <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #9A3412; margin: 0 0 6px 0;">WhatsApp & Telefone</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; font-weight: 600; color: #7C2D12; margin: 0 0 8px 0;">(44) 99766-2565</p>
          <span style="font-size: 12px; color: #C25E0E;">Segunda a Sexta das 8h às 18h</span>
        </div>
        <div style="flex: 1 1 280px; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 14px; padding: 24px; box-sizing: border-box;">
          <div style="font-size: 26px; margin-bottom: 8px;">✉️</div>
          <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #9A3412; margin: 0 0 6px 0;">E-mail Oficial</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; font-weight: 600; color: #7C2D12; margin: 0 0 8px 0;">contato@oxxpharma.com.br</p>
          <span style="font-size: 12px; color: #C25E0E;">Resposta em até 24h úteis</span>
        </div>
        <div style="flex: 1 1 280px; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 14px; padding: 24px; box-sizing: border-box;">
          <div style="font-size: 26px; margin-bottom: 8px;">📍</div>
          <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #9A3412; margin: 0 0 6px 0;">Endereço & Retirada</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 15px; font-weight: 600; color: #7C2D12; margin: 0 0 8px 0;">Rua Neo Alves Martins, 3177</p>
          <span style="font-size: 12px; color: #C25E0E;">Zona 01 · Maringá / PR</span>
        </div>
      </div>
    `,
  });

  bm.add('cms-faq-block', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-question-circle-o" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">FAQ / Dúvidas Frequentes</div>
      </div>
    `,
    category: 'Atendimento & FAQ',
    content: `
      <div style="max-width: 800px; margin: 36px auto; padding: 0 20px;">
        <h3 style="font-family: 'Anona', sans-serif; font-size: 26px; font-weight: 800; color: #0F172A; margin: 0 0 24px 0; text-align: center;">Perguntas Frequentes</h3>
        <div style="margin-bottom: 16px; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; background: #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
          <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #1E293B; margin: 0 0 8px 0;">Qual é o prazo médio de manipulação das fórmulas?</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Fórmulas convencionais levam de 24 a 48 horas úteis após a confirmação do pagamento. Produtos da linha pronta entrega são despachados no mesmo dia útil se aprovados até as 13h.</p>
        </div>
        <div style="margin-bottom: 16px; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; background: #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
          <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #1E293B; margin: 0 0 8px 0;">Como posso rastrear meu pedido?</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Assim que seu pedido for despachado pela transportadora ou Correios, você receberá o código de rastreamento por e-mail e poderá acompanhar em tempo real na seção Meus Pedidos.</p>
        </div>
        <div style="margin-bottom: 16px; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; background: #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
          <h4 style="font-family: 'Anona', sans-serif; font-size: 16px; font-weight: 700; color: #1E293B; margin: 0 0 8px 0;">É possível retirar meu pedido pessoalmente?</h4>
          <p style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #64748B; line-height: 1.6; margin: 0;">Sim! No checkout basta escolher a opção 'Quero retirar no local' com frete grátis em nossa farmácia em Maringá/PR.</p>
        </div>
      </div>
    `,
  });

  bm.add('cms-table-info', {
    label: `
      <div style="text-align:center;padding:4px;">
        <i class="fa fa-table" style="font-size:20px;color:#E8731A;margin-bottom:6px;display:block;"></i>
        <div style="font-size:11px;font-weight:700;">Tabela Informativa</div>
      </div>
    `,
    category: 'Atendimento & FAQ',
    content: `
      <div style="max-width: 900px; margin: 32px auto; padding: 0 20px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; text-align: left;">
          <thead>
            <tr style="background: #FFF7ED; border-bottom: 2px solid #FED7AA;">
              <th style="padding: 12px 16px; font-family: 'Anona', sans-serif; font-weight: 700; color: #9A3412;">Modalidade</th>
              <th style="padding: 12px 16px; font-family: 'Anona', sans-serif; font-weight: 700; color: #9A3412;">Prazo Estimado</th>
              <th style="padding: 12px 16px; font-family: 'Anona', sans-serif; font-weight: 700; color: #9A3412;">Condição</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 12px 16px; font-weight: 600; color: #1E293B;">Retirada no Balcão</td>
              <td style="padding: 12px 16px; color: #64748B;">Mesmo dia ou 24h</td>
              <td style="padding: 12px 16px; color: #10B981; font-weight: 600;">Frete Grátis</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0; background: #F8FAFC;">
              <td style="padding: 12px 16px; font-weight: 600; color: #1E293B;">Entrega Expressa Regional</td>
              <td style="padding: 12px 16px; color: #64748B;">1 a 2 dias úteis</td>
              <td style="padding: 12px 16px; color: #64748B;">Maringá e região</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 12px 16px; font-weight: 600; color: #1E293B;">Envio Nacional (Correios / Jadlog)</td>
              <td style="padding: 12px 16px; color: #64748B;">3 a 8 dias úteis</td>
              <td style="padding: 12px 16px; color: #64748B;">Todo o Brasil</td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
  });
}
