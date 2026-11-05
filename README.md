# AgencyOS — Sistema Operacional de Agências (MVP)

> Plataforma SaaS de automação para agências de publicidade, design e gestão de redes sociais com IA (Brand Brain).

---

## 🚀 Como Executar em Localhost

O projeto é um monorepo com backend (Express + Prisma + PostgreSQL) e frontend (Vite + React). Ele **não roda "no vácuo"**: precisa de um banco Postgres e de um storage compatível com S3 (MinIO) — o `docker-compose.yml` na raiz sobe os dois localmente em segundos.

### 1. Subir Postgres + MinIO locais
```bash
docker compose up -d
```
Isso sobe:
- **Postgres** em `localhost:5432` (user/senha: `agencyflow` / `agencyflow`, banco: `agencyflow`)
- **MinIO** (API em `localhost:9000`, Console em `localhost:9001`, user/senha: `agencyflow` / `agencyflow123`)

Crie o bucket de assets uma única vez:
```bash
docker run --rm --network agencyos_default --entrypoint sh minio/mc:latest -c \
  "mc alias set local http://minio:9000 agencyflow agencyflow123 && mc mb local/agencyflow-assets && mc anonymous set download local/agencyflow-assets"
```

### 2. Configurar variáveis de ambiente
```bash
cp apps/api/.env.example apps/api/.env
```
Os valores padrão já apontam para o Postgres/MinIO locais do passo 1. Preencha pelo menos `JWT_SECRET`, `JWT_REFRESH_SECRET` e `ENCRYPTION_KEY` (veja os comandos de geração nos comentários do próprio arquivo).

### 3. Instalar dependências e preparar o banco
```bash
npm install
npm run db:push --workspace=apps/api      # cria as tabelas a partir do schema.prisma
npm run db:seed --workspace=apps/api      # opcional: popula com dados de exemplo para explorar o app
```

> **Nota de ambiente restrito:** o `prisma generate`/`db:push` baixa um binário nativo (engine) na primeira vez. Se sua rede bloquear `binaries.prisma.sh` (proxy corporativo, firewall), rode esses dois comandos dentro de um container Docker temporário apontando para o mesmo Postgres — o tráfego do Docker costuma sair por uma rota diferente da do host.

### 4. Rodar a aplicação
```bash
npm run dev   # backend em :3001 e frontend em :5173 juntos
```

Acesse `http://localhost:5173`, clique em **"Criar uma agência"** e cadastre sua própria conta — não há login pré-configurado.

---

## 🧠 Módulos Implementados

1. **Autenticação & Multi-Tenancy**:
   - Login, Registro de nova agência, JWT (Access + Refresh token com rotação).
   - Isolamento total por `agencyId`.
   - Cargos e permissões (`OWNER`, `ADMIN`, `MANAGER`, `DESIGNER`, `COPYWRITER`, `CLIENT`).

2. **Gestão de Clientes**:
   - Cadastro completo, setor, redes sociais, contatos e responsáveis.

3. **Brand Brain (Cérebro da Marca)**:
   - Identidade, missão, visão, posicionamento, público-alvo e tom de voz.
   - **Regras Obrigatórias (DO / DONT)** para guiar a IA.
   - **Paleta de Cores & Tipografia**.
   - **Pilares de Conteúdo** com metas percentuais.
   - **Memória de Aprendizagem por Feedback**: Feedbacks de clientes viram regras automáticas no Brand Brain.

4. **IA Generativa (AI Copywriter, Strategy & Imagens)**:
   - Cada agência pode conectar sua própria chave de API em **Configurações → Integração de IA** — o custo de uso vai direto para a conta da agência na OpenAI, sem depender de crédito compartilhado.
   - **Análise de Marca com IA**, **Gerador de Calendário Completo**, **Legendas alinhadas ao Brand Brain**, **Hooks virais e CTAs**.
   - **Geração de Propostas de Imagem** com base no brief e na paleta de cores da marca — o resultado é salvo como Asset real (MinIO/S3), não uma prévia perdível.
   - Sem chave configurada (nem por agência, nem no servidor), o sistema cai automaticamente em respostas mock — dá pra testar o fluxo inteiro sem gastar nada.

5. **Workspace de Conteúdos**:
   - Layout com **Preview Social em Tempo Real (Instagram)**.
   - Editor de Briefing, Hook, Legenda e CTA.
   - Comentários e histórico de versões.

6. **Portal Público de Aprovação do Cliente**:
   - Link compartilhável (`/approval/:token`) onde o cliente aprova ou solicita ajustes sem precisar fazer login.

7. **Dashboard & Indicadores de Atenção**:
   - KPIs de clientes, posts agendados, conteúdos atrasados e aprovações.
   - Bloco inteligente "Precisa de Atenção".

8. **Relatórios Mensais com IA**:
   - Geração e publicação de relatórios com link público.

9. **Google Ads e Analytics (GA4)**:
   - Ligações OAuth por cliente, com escolha da conta de anúncios ou propriedade GA4.
   - Google Ads: campanhas, investimento, cliques, impressões, conversões, CTR e CPC; pausa/reativação manual.
   - GA4: utilizadores, sessões, visualizações, eventos principais, páginas, canais e países do tráfego web.
   - Períodos Hoje, 7 e 30 dias e recomendações do Brand Brain baseadas nos dados consultados.

### Configurar Google Ads e GA4

1. No Google Cloud da agência, ative **Google Ads API**, **Google Analytics Data API** e **Google Analytics Admin API**. O projeto precisa de acesso à API Google Ads para contas de produção.
2. Configure o consentimento OAuth e um **OAuth Client ID do tipo Web application**. Autorize os escopos `https://www.googleapis.com/auth/adwords` e `https://www.googleapis.com/auth/analytics.readonly` conforme o fluxo de verificação do Google.
3. Adicione `${APP_URL}/api/v1/google/callback` aos URIs de redirecionamento autorizados no Google Cloud. Use exatamente o mesmo domínio configurado em `APP_URL` (em localhost, `http://localhost:5173/api/v1/google/callback`).
4. Em **Redes Sociais → Agência → YouTube**, guarde o Client ID e o Client Secret deste projeto Google Cloud. A integração Google Ads/GA4 reutiliza estas credenciais, mas guarda uma ligação OAuth separada para cada serviço e cliente.
5. Em **Google Ads & Analytics**, selecione o cliente, ligue o serviço e escolha a conta/propriedade correta. O utilizador Google deve ter acesso a essa conta. Para contas Google Ads sob um gestor, a aplicação descobre também as contas cliente e envia o respetivo `login-customer-id`.

As recomendações da IA são apenas sugestões; a aplicação não executa mudanças propostas pela IA. O Google Ads permite pausar ou reativar campanhas manualmente, após confirmação.

---

## 🌐 Produção

A stack já é a de produção — Postgres + storage S3-compatível — só muda **onde** cada peça está hospedada.

### 1. Banco de Dados PostgreSQL
Troque `DATABASE_URL` em `apps/api/.env` para o Postgres real (Supabase, Neon, RDS, VM própria...):
```env
DATABASE_URL="postgresql://usuario:senha@host:5432/agencyflow?schema=public"
```
Depois rode as migrations:
```bash
npm run db:migrate:prod --workspace=apps/api
```
`npm run db:seed` é **só para desenvolvimento/demonstração** — não rode em produção a menos que queira dados de exemplo visíveis para os usuários reais.

### 2. Storage — S3 / MinIO / Cloudflare R2
Troque os valores de `S3_*` em `apps/api/.env` para o storage real:
```env
STORAGE_TYPE=s3
S3_ENDPOINT=https://<seu-endpoint>
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=agencyflow-assets
```

### 3. Segredos
Gere valores reais e aleatórios para `JWT_SECRET`, `JWT_REFRESH_SECRET` e `ENCRYPTION_KEY` (nunca reutilize os defaults de desenvolvimento). Comandos prontos nos comentários de `apps/api/.env.example`.

### 4. IA
`OPENAI_API_KEY` no `.env` é só o fallback do servidor — cada agência normalmente conecta a própria chave pela interface (Configurações → Integração de IA), que fica criptografada no banco.
