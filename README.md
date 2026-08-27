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
