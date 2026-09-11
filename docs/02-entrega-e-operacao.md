# DashDriver — entrega e operação

Atualização: 11/09/2026.

## Estrutura
- `06_DEV`: app PWA em HTML/CSS/JavaScript; `admin.html` no mesmo projeto.
- `api/`: funções Vercel para autenticação, Lastlink, OCR, suporte, exportação, e-mail e push.
- Supabase: autenticação, Postgres e isolamento de registros por usuário via RLS.
- `06_LP`: Next.js/React; página comercial, termos e privacidade; checkout centralizado em `src/lib/product.ts`.
- GitHub main dispara produção na Vercel, em projetos separados para app e LP.

## Alterações
Tema escuro e azul; fontes locais; canais e-mail/push; WhatsApp desativado (410); suporte compatível com schema; JWT com validação de emissor, audiência e expiração e confirmação da conta; cache local separado por conta; tokens novos de recuperação armazenados como hash; validação de imagens e destinos push; exportação autenticada; quota de OCR por usuário; webhook com produto permitido, idempotência e proteção contra eventos antigos.

## Banco
Usuário confirmou execução sem erro de `migrations/011_launch_security.sql` em 11/09/2026. Diagnóstico indicou RLS ativo e políticas de dados próprios. GRANT SELECT a anon, sozinho, não ignora RLS. O diagnóstico não comprova constraints, backups nem operação das integrações.

## Antes de liberar vendas
1. Fazer uma compra controlada na Lastlink: conferir evento aceito, plano ativo, e-mail recebido, senha definida e login. Verificar renovação, fim de acesso e reembolso com contas de teste apropriadas.
2. Importar print sem dados pessoais de passageiros; conferir OCR, salvar corrida e verificar quota. OPENAI_API_KEY está cadastrada na Vercel, mas validade/créditos não foram testados.
3. Testar suporte com conta comum e resposta no admin; exportação; isolamento com duas contas; notificação em dispositivo real. Validar remetente/domínio de e-mail. Nenhum disparo real foi feito durante a revisão.
4. Confirmar responsável legal e canal suporte@dashdriver.com.br; definir retenção, exclusão e atendimento de direitos. Páginas publicadas são uma base operacional, não certificação de conformidade LGPD.
5. Resolver o alerta de saúde observado no Supabase e configurar/verificar backups e restauração. A conexão Postgres mantém configuração TLS anterior com rejectUnauthorized:false; falta configurar CA e validar certificado antes de considerar a segurança concluída.

## Configuração e limites
- LASTLINK_PRODUCT_IDS: UUID visto na rota de integrações do produto Dashdriver; conferir correspondência com Data.Product.Id no primeiro evento real.
- LASTLINK_WEBHOOK_TOKEN/LASTLINK_TOKEN: não divulgar. URL do webhook já aponta para o app.
- E-mail: Resend prioritário, Gmail alternativo; conferir MAIL_FROM e domínio/remetente.
- Admin: ADMIN_EMAILS pode definir responsáveis; sem ela permanece o administrador existente no código.
- Disparos manuais: limite de 20 destinatários; expansão exige fila e deduplicação persistente.
- OCR: 60 solicitações por hora por usuário com plano permitido; usa OpenAI gpt-4o-mini.
- Segredos antigos de Evolution e Stripe permanecem na Vercel; podem ser removidos após confirmar ausência de dependências externas.
- Não usar credenciais de produção em previews de código não confiável. Há credenciais antigas também no ambiente Preview; revisar esse escopo.

## Verificação
25 testes automatizados do app passaram antes desta entrega. Lint, TypeScript e build de produção da LP passaram. Testes usam mocks: não comprovam entrega de e-mails, OCR real, cobrança ou acesso ao banco em produção.
