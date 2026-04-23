# OxxPharma - Test Credentials

## Admin
- **Email**: admin@oxxpharma.com
- **Password**: admin123
- **Access Level**: 0 (admin)
- **Role**: admin (acessa /backoffice)

## Observações
- O admin é criado automaticamente no startup do backend
- Clientes comuns se cadastram em /cadastrar (role: customer, access_level: 99)
- Cadastro via /cadastrar gera automaticamente um `referral_code` único
- Clientes cadastrados com `?ref=XXX` na URL capturam o sponsor automaticamente
- Comissão de afiliado fixada em 8% sobre o subtotal (AFFILIATE_COMMISSION_RATE)

## Fluxo E-commerce (MVP)
- Loja pública: `/` (sem auth para navegar e adicionar ao carrinho)
- Checkout requer login
- Pagamento: MOCK (botão "Simular pagamento" na tela do pedido)
- Mercado Pago: estrutura preparada, ativa ao setar `MERCADO_PAGO_ACCESS_TOKEN` no .env
