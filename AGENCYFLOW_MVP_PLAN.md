# AgencyFlow AI — Planejamento Técnico Completo do MVP

> Documento de produto e implementação para construção de um SaaS de automação para agências de publicidade, design e gestão de redes sociais.

---

# 1. VISÃO DO PRODUTO

## 1.1 Nome provisório
**AgencyFlow AI**

Outros nomes possíveis:
- Agency OS
- CreativeOps AI
- SocialFlow AI
- AgencyPilot
- BrandFlow AI

## 1.2 Objetivo principal

Criar uma plataforma SaaS que permita a uma agência de publicidade automatizar aproximadamente **90% das tarefas operacionais repetitivas** ligadas a:

- onboarding de clientes;
- organização de briefing;
- estratégia de conteúdo;
- calendário editorial;
- criação de copies;
- criação e adaptação de designs;
- aprovação de conteúdo;
- agendamento e publicação;
- recolha de métricas;
- relatórios;
- gestão interna da equipa;
- armazenamento de conhecimento da marca;
- aprendizagem baseada em alterações e aprovações do cliente.

A plataforma deve funcionar como um **Sistema Operacional da Agência**, centralizando o processo completo:

```text
CLIENTE
  ↓
BRIEFING
  ↓
BRAND BRAIN
  ↓
ESTRATÉGIA
  ↓
CALENDÁRIO
  ↓
CONTEÚDO
  ↓
DESIGN
  ↓
APROVAÇÃO
  ↓
AGENDAMENTO
  ↓
PUBLICAÇÃO
  ↓
ANALYTICS
  ↓
RELATÓRIO
  ↓
APRENDIZAGEM
```

---

# 2. PROBLEMAS QUE O MVP DEVE RESOLVER

## 2.1 Dores atuais das agências

1. Informações do cliente espalhadas no WhatsApp, Drive e e-mail.
2. Designers não conhecem suficientemente a marca.
3. Copywriters repetem perguntas sobre público, tom e serviços.
4. Aprovações acontecem de forma desorganizada.
5. Alterações são esquecidas.
6. O cliente pede novamente alterações já solicitadas antes.
7. Conteúdos são criados sem histórico das aprovações anteriores.
8. É necessário copiar manualmente legendas entre ferramentas.
9. Agendamento de posts consome tempo.
10. Relatórios mensais são manuais.
11. Métricas são mostradas sem interpretação.
12. A direção da agência não consegue acompanhar dezenas de clientes facilmente.
13. Ficheiros de cada marca ficam espalhados.
14. Calendários editoriais são criados manualmente todos os meses.
15. Há pouca ligação entre conteúdo publicado e resultados comerciais.

---

# 3. PRINCÍPIOS DO PRODUTO

O MVP deve seguir estes princípios:

### 3.1 IA como assistente operacional
A IA não substitui completamente o humano.

Ela deve:
- criar;
- sugerir;
- classificar;
- organizar;
- resumir;
- transformar;
- aprender;
- automatizar.

O humano deve:
- aprovar;
- corrigir;
- tomar decisões;
- definir direção criativa;
- gerir situações críticas.

### 3.2 Multi-tenant desde o início
O sistema deve ser preparado para várias agências.

Estrutura:

```text
PLATAFORMA
  ↓
AGÊNCIA
  ↓
CLIENTES DA AGÊNCIA
  ↓
UTILIZADORES
```

Nenhuma agência pode visualizar dados de outra agência.

### 3.3 Brand Brain como núcleo do sistema
Cada cliente deve possuir uma memória de marca.

### 3.4 Tudo deve ter histórico
Conteúdos, alterações, aprovações e versões precisam de histórico.

### 3.5 Automação por eventos
A arquitetura deve permitir:

```text
evento
  ↓
fila
  ↓
automação
  ↓
resultado
```

Exemplo:

```text
POST_APROVADO
  ↓
criar publicação agendada
  ↓
publicar na rede social
```

---

# 4. ESCOPO DO MVP

O MVP deve conter os seguintes módulos.

## 4.1 Autenticação
- login;
- logout;
- recuperação de senha;
- convite de membros;
- seleção de agência;
- gestão de perfil.

## 4.2 Agência
- dados da agência;
- logo;
- membros;
- cargos;
- permissões.

## 4.3 Clientes
- cadastro;
- contactos;
- redes sociais;
- serviços contratados;
- estado;
- responsável interno;
- data de início;
- notas.

## 4.4 Brand Brain
- identidade;
- público;
- tom de voz;
- produtos;
- serviços;
- palavras preferidas;
- palavras proibidas;
- CTAs;
- concorrentes;
- referências;
- histórico de feedback;
- documentos;
- assets.

## 4.5 AI Strategy
Gerar:
- resumo da marca;
- posicionamento;
- personas;
- pilares;
- objetivos;
- estratégia mensal;
- sugestões de conteúdo.

## 4.6 Content Calendar
- calendário mensal;
- conteúdos;
- formatos;
- datas;
- plataformas;
- estados;
- responsáveis.

## 4.7 AI Copywriter
Criar:
- títulos;
- hooks;
- legendas;
- CTAs;
- hashtags;
- roteiros curtos;
- variações.

## 4.8 Content Workspace
Cada conteúdo precisa de:
- briefing;
- copy;
- design;
- plataformas;
- data;
- anexos;
- histórico;
- comentários;
- aprovação.

## 4.9 Approval Portal
Cliente recebe um link.

Pode:
- aprovar;
- rejeitar;
- pedir alteração;
- comentar;
- visualizar versões.

## 4.10 Social Publishing
No MVP:
- Facebook;
- Instagram.

Preparar arquitetura para:
- LinkedIn;
- TikTok;
- YouTube;
- X.

## 4.11 Analytics
- métricas por post;
- métricas por plataforma;
- crescimento mensal;
- top posts;
- pior desempenho;
- resumo AI.

## 4.12 Reports
- relatório mensal;
- versão online;
- exportação PDF futuramente;
- resumo AI.

## 4.13 Dashboard interno
Mostrar:
- clientes;
- conteúdos;
- conteúdos em aprovação;
- atrasados;
- agendados;
- publicados;
- clientes sem conteúdo futuro.

---

# 5. FORA DO MVP

Não implementar inicialmente:

- faturação completa;
- payroll;
- gestão financeira avançada;
- editor de vídeo completo;
- geração de vídeos longos;
- chatbot omnicanal avançado;
- CRM comercial completo;
- Meta Ads Manager completo;
- Google Ads;
- marketplace;
- aplicação mobile;
- automação de WhatsApp em massa;
- gerador completo estilo Canva.

A arquitetura deve permitir expansão futura.

---

# 6. STACK RECOMENDADA

## 6.1 Frontend

```text
React
Vite
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
React Router
Zustand
React Hook Form
Zod
```

## 6.2 Backend

Preferência:

```text
Node.js
NestJS
TypeScript
Prisma ORM
PostgreSQL
```

Alternativa:

```text
Node.js
Fastify
```

## 6.3 Banco de dados

```text
PostgreSQL 16+
```

Extensões:

```text
pgvector
uuid-ossp
```

## 6.4 Jobs

```text
Redis
BullMQ
```

Utilização:
- publicação;
- IA;
- métricas;
- notificações;
- geração de relatório;
- webhooks.

## 6.5 Storage

```text
S3 compatible
```

Pode utilizar:
- MinIO;
- Cloudflare R2;
- AWS S3.

## 6.6 Automação

```text
n8n
```

Deve ser opcional.

A lógica crítica da plataforma não deve depender exclusivamente do n8n.

## 6.7 IA

Criar uma camada abstrata:

```text
AIProvider
```

Para permitir:

- OpenAI;
- Anthropic;
- Gemini;
- modelos locais.

Exemplo:

```ts
interface AIProvider {
  generateText(input: AIRequest): Promise<AIResponse>
  generateStructured<T>(input: AIRequest): Promise<T>
  embeddings(input: string[]): Promise<number[][]>
}
```

---

# 7. ARQUITETURA

```text
FRONTEND
  │
  ▼
API GATEWAY
  │
  ├── Auth
  ├── Agencies
  ├── Clients
  ├── Brand Brain
  ├── Content
  ├── Approval
  ├── Social
  ├── Analytics
  ├── AI
  └── Reports
       │
       ▼
POSTGRESQL
       │
       ├── pgvector
       │
       ▼
REDIS / BULLMQ
       │
       ├── AI JOBS
       ├── SOCIAL JOBS
       ├── ANALYTICS JOBS
       └── NOTIFICATION JOBS
       │
       ▼
EXTERNAL SERVICES
       ├── Meta API
       ├── AI Provider
       ├── S3
       └── n8n
```

---

# 8. MODELO MULTI-TENANT

Todas as tabelas pertencentes a uma agência devem conter:

```text
agency_id
```

Nunca confiar no `agency_id` enviado pelo frontend.

O backend deve determinar a agência através do utilizador autenticado.

Exemplo:

```text
request.user.agencyId
```

Filtros:

```sql
WHERE agency_id = current_user_agency_id
```

---

# 9. CARGOS

## 9.1 OWNER
Pode:
- tudo;
- billing;
- eliminar agência;
- gerir membros.

## 9.2 ADMIN
Pode:
- clientes;
- equipa;
- conteúdo;
- publicação;
- relatórios.

## 9.3 MANAGER
Pode:
- clientes atribuídos;
- conteúdo;
- calendário;
- aprovação.

## 9.4 DESIGNER
Pode:
- visualizar clientes atribuídos;
- editar conteúdos;
- upload de designs.

## 9.5 COPYWRITER
Pode:
- briefings;
- copies;
- calendários.

## 9.6 CLIENT
Acesso apenas ao portal:
- conteúdos;
- aprovações;
- comentários;
- relatórios.

---

# 10. ESTADOS GERAIS DO CONTEÚDO

```text
IDEA
DRAFT
IN_PRODUCTION
INTERNAL_REVIEW
CLIENT_REVIEW
CHANGES_REQUESTED
APPROVED
SCHEDULED
PUBLISHED
FAILED
ARCHIVED
```

Fluxo recomendado:

```text
IDEA
 ↓
DRAFT
 ↓
IN_PRODUCTION
 ↓
INTERNAL_REVIEW
 ↓
CLIENT_REVIEW
 ├── CHANGES_REQUESTED
 │      ↓
 │    IN_PRODUCTION
 │
 └── APPROVED
        ↓
      SCHEDULED
        ↓
      PUBLISHED
```

---

# 11. MODELO DE BANCO DE DADOS

---

## 11.1 users

```sql
id UUID PK
name VARCHAR(150)
email VARCHAR(200) UNIQUE
password_hash TEXT
avatar_url TEXT NULL
status VARCHAR(30)
last_login_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 11.2 agencies

```sql
id UUID PK
name VARCHAR(200)
slug VARCHAR(100) UNIQUE
logo_url TEXT NULL
country VARCHAR(100) NULL
timezone VARCHAR(100) DEFAULT 'Africa/Maputo'
locale VARCHAR(20) DEFAULT 'pt-MZ'
status VARCHAR(30)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 11.3 agency_members

```sql
id UUID PK
agency_id UUID FK agencies
user_id UUID FK users
role VARCHAR(30)
status VARCHAR(30)
invited_at TIMESTAMP NULL
joined_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP

UNIQUE(agency_id, user_id)
```

---

## 11.4 clients

```sql
id UUID PK
agency_id UUID FK agencies
name VARCHAR(200)
legal_name VARCHAR(250) NULL
slug VARCHAR(100)
industry VARCHAR(150) NULL
website TEXT NULL
description TEXT NULL
email VARCHAR(200) NULL
phone VARCHAR(50) NULL
country VARCHAR(100) NULL
city VARCHAR(100) NULL
status VARCHAR(30)
account_manager_id UUID NULL FK users
start_date DATE NULL
end_date DATE NULL
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL

UNIQUE(agency_id, slug)
```

---

## 11.5 client_contacts

```sql
id UUID PK
agency_id UUID
client_id UUID FK clients
name VARCHAR(200)
position VARCHAR(150) NULL
email VARCHAR(200) NULL
phone VARCHAR(50) NULL
is_primary BOOLEAN DEFAULT false
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 11.6 client_social_accounts

```sql
id UUID PK
agency_id UUID
client_id UUID
platform VARCHAR(50)
username VARCHAR(150) NULL
profile_url TEXT NULL
external_account_id VARCHAR(255) NULL
status VARCHAR(30)
created_at TIMESTAMP
updated_at TIMESTAMP
```

`platform`:

```text
FACEBOOK
INSTAGRAM
LINKEDIN
TIKTOK
YOUTUBE
X
```

---

# 12. BRAND BRAIN

---

## 12.1 brand_profiles

```sql
id UUID PK
agency_id UUID
client_id UUID UNIQUE
brand_summary TEXT NULL
mission TEXT NULL
vision TEXT NULL
positioning TEXT NULL
target_audience TEXT NULL
tone_of_voice TEXT NULL
brand_personality TEXT NULL
primary_language VARCHAR(20) DEFAULT 'pt'
secondary_language VARCHAR(20) NULL
default_cta TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 12.2 brand_colors

```sql
id UUID PK
agency_id UUID
client_id UUID
name VARCHAR(100)
hex VARCHAR(10)
rgb VARCHAR(50) NULL
usage_notes TEXT NULL
priority INT DEFAULT 0
```

---

## 12.3 brand_fonts

```sql
id UUID PK
agency_id UUID
client_id UUID
name VARCHAR(150)
role VARCHAR(50)
usage_notes TEXT NULL
```

role:

```text
PRIMARY
SECONDARY
DISPLAY
BODY
```

---

## 12.4 brand_products

```sql
id UUID PK
agency_id UUID
client_id UUID
name VARCHAR(200)
description TEXT NULL
category VARCHAR(150) NULL
benefits JSONB
features JSONB
price_text VARCHAR(100) NULL
status VARCHAR(30)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 12.5 brand_services

```sql
id UUID PK
agency_id UUID
client_id UUID
name VARCHAR(200)
description TEXT NULL
benefits JSONB
target_audience TEXT NULL
status VARCHAR(30)
```

---

## 12.6 brand_personas

```sql
id UUID PK
agency_id UUID
client_id UUID
name VARCHAR(150)
age_range VARCHAR(50) NULL
location VARCHAR(150) NULL
profession VARCHAR(150) NULL
description TEXT
pain_points JSONB
goals JSONB
objections JSONB
preferred_channels JSONB
```

---

## 12.7 brand_content_pillars

```sql
id UUID PK
agency_id UUID
client_id UUID
name VARCHAR(150)
description TEXT
percentage_target DECIMAL(5,2) NULL
examples JSONB
status VARCHAR(30)
```

Exemplos:

```text
EDUCATION
SALES
INSTITUTIONAL
SOCIAL_PROOF
ENTERTAINMENT
PRODUCT
```

---

## 12.8 brand_rules

Uma das tabelas mais importantes.

```sql
id UUID PK
agency_id UUID
client_id UUID
rule_type VARCHAR(50)
rule_text TEXT
source VARCHAR(50)
importance INT DEFAULT 5
active BOOLEAN DEFAULT true
created_at TIMESTAMP
updated_at TIMESTAMP
```

`rule_type`:

```text
DO
DONT
TONE
DESIGN
COPY
COLOR
IMAGE
CTA
PRODUCT
LEGAL
OTHER
```

`source`:

```text
ONBOARDING
CLIENT_FEEDBACK
MANUAL
AI_EXTRACTED
```

Exemplo:

```text
rule_type = DESIGN
rule_text = "Usar azul como cor predominante."
```

---

## 12.9 brand_feedback_memory

Guardar o feedback real do cliente.

```sql
id UUID PK
agency_id UUID
client_id UUID
content_id UUID NULL
feedback_text TEXT
normalized_instruction TEXT NULL
category VARCHAR(50) NULL
sentiment VARCHAR(30) NULL
is_global_rule BOOLEAN DEFAULT false
embedding VECTOR NULL
created_by UUID NULL
created_at TIMESTAMP
```

Exemplo:

```text
feedback_text:
"Não quero que o logo fique tão perto da borda."

normalized_instruction:
"Manter margem mínima de segurança ao redor do logotipo."
```

Se `is_global_rule = true`, também criar ou atualizar `brand_rules`.

---

# 13. ASSETS

## 13.1 assets

```sql
id UUID PK
agency_id UUID
client_id UUID NULL
uploaded_by UUID
type VARCHAR(50)
name VARCHAR(255)
mime_type VARCHAR(100)
file_size BIGINT
storage_key TEXT
public_url TEXT NULL
metadata JSONB
created_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

Tipos:

```text
LOGO
IMAGE
VIDEO
DOCUMENT
FONT_REFERENCE
BRAND_GUIDELINE
DESIGN
THUMBNAIL
OTHER
```

---

# 14. AI STRATEGIES

## 14.1 strategies

```sql
id UUID PK
agency_id UUID
client_id UUID
title VARCHAR(200)
period_start DATE
period_end DATE
objective TEXT
strategy_summary TEXT
generated_by VARCHAR(30)
status VARCHAR(30)
created_by UUID
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 14.2 strategy_recommendations

```sql
id UUID PK
agency_id UUID
strategy_id UUID
category VARCHAR(100)
title VARCHAR(200)
description TEXT
priority INT
accepted BOOLEAN NULL
```

---

# 15. CONTENT CALENDAR

## 15.1 content_calendars

```sql
id UUID PK
agency_id UUID
client_id UUID
name VARCHAR(200)
month INT
year INT
strategy_id UUID NULL
status VARCHAR(30)
created_by UUID
created_at TIMESTAMP
updated_at TIMESTAMP

UNIQUE(client_id, month, year)
```

---

# 16. CONTENT

## 16.1 contents

Tabela principal.

```sql
id UUID PK
agency_id UUID
client_id UUID
calendar_id UUID NULL
content_pillar_id UUID NULL
title VARCHAR(250)
internal_title VARCHAR(250) NULL
content_type VARCHAR(50)
objective VARCHAR(100) NULL
brief TEXT NULL
hook TEXT NULL
caption TEXT NULL
cta TEXT NULL
hashtags JSONB
status VARCHAR(50)
priority VARCHAR(30)
scheduled_at TIMESTAMP NULL
published_at TIMESTAMP NULL
due_at TIMESTAMP NULL
created_by UUID
assigned_to UUID NULL
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

`content_type`:

```text
IMAGE
CAROUSEL
REEL
STORY
VIDEO
TEXT
ARTICLE
```

---

## 16.2 content_platforms

Um conteúdo pode ser usado em várias redes.

```sql
id UUID PK
agency_id UUID
content_id UUID
platform VARCHAR(50)
enabled BOOLEAN DEFAULT true
platform_caption TEXT NULL
platform_hashtags JSONB NULL
scheduled_at TIMESTAMP NULL
status VARCHAR(30)
external_post_id VARCHAR(255) NULL
external_post_url TEXT NULL
published_at TIMESTAMP NULL
publish_error TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 16.3 content_assets

```sql
id UUID PK
agency_id UUID
content_id UUID
asset_id UUID
role VARCHAR(50)
sort_order INT DEFAULT 0
created_at TIMESTAMP
```

roles:

```text
PRIMARY
THUMBNAIL
SLIDE
REFERENCE
SOURCE
```

---

# 17. VERSÕES DE CONTEÚDO

Extremamente importante.

## 17.1 content_versions

```sql
id UUID PK
agency_id UUID
content_id UUID
version_number INT
caption TEXT NULL
hook TEXT NULL
cta TEXT NULL
brief TEXT NULL
snapshot JSONB
created_by UUID
change_reason TEXT NULL
created_at TIMESTAMP

UNIQUE(content_id, version_number)
```

Sempre criar uma versão antes de alterações importantes.

---

# 18. COMENTÁRIOS E ALTERAÇÕES

## 18.1 content_comments

```sql
id UUID PK
agency_id UUID
content_id UUID
user_id UUID NULL
client_contact_id UUID NULL
parent_id UUID NULL
comment TEXT
x_position DECIMAL NULL
y_position DECIMAL NULL
resolved BOOLEAN DEFAULT false
created_at TIMESTAMP
updated_at TIMESTAMP
```

`x_position` e `y_position` permitem comentários diretamente sobre a imagem.

---

# 19. APROVAÇÃO

## 19.1 approval_requests

```sql
id UUID PK
agency_id UUID
client_id UUID
content_id UUID
token VARCHAR(255) UNIQUE
status VARCHAR(30)
requested_by UUID
expires_at TIMESTAMP NULL
sent_at TIMESTAMP NULL
viewed_at TIMESTAMP NULL
completed_at TIMESTAMP NULL
created_at TIMESTAMP
```

status:

```text
PENDING
VIEWED
APPROVED
CHANGES_REQUESTED
REJECTED
EXPIRED
```

---

## 19.2 approval_actions

```sql
id UUID PK
agency_id UUID
approval_request_id UUID
action VARCHAR(30)
comment TEXT NULL
actor_name VARCHAR(200) NULL
actor_email VARCHAR(200) NULL
created_at TIMESTAMP
```

---

# 20. AI GENERATIONS

Todas as chamadas AI devem ter histórico.

## 20.1 ai_generations

```sql
id UUID PK
agency_id UUID
client_id UUID NULL
content_id UUID NULL
user_id UUID
task_type VARCHAR(100)
provider VARCHAR(50)
model VARCHAR(100)
prompt_version VARCHAR(50) NULL
input JSONB
output JSONB
input_tokens INT NULL
output_tokens INT NULL
cost DECIMAL(12,6) NULL
status VARCHAR(30)
error TEXT NULL
created_at TIMESTAMP
```

Tipos:

```text
BRAND_ANALYSIS
CONTENT_STRATEGY
CONTENT_IDEAS
CAPTION
HOOK
CTA
HASHTAGS
REWRITE
FEEDBACK_NORMALIZATION
REPORT_SUMMARY
PERFORMANCE_ANALYSIS
```

---

# 21. EMBEDDINGS E MEMÓRIA

## 21.1 knowledge_chunks

```sql
id UUID PK
agency_id UUID
client_id UUID
source_type VARCHAR(50)
source_id UUID NULL
text_content TEXT
metadata JSONB
embedding VECTOR
created_at TIMESTAMP
updated_at TIMESTAMP
```

Fontes:

```text
BRAND_PROFILE
BRAND_RULE
DOCUMENT
FEEDBACK
PRODUCT
SERVICE
APPROVED_CONTENT
```

## 21.2 RAG

Antes de gerar conteúdo:

```text
1. Receber pedido
2. Criar embedding da intenção
3. Procurar conhecimento relevante do cliente
4. Buscar regras de marca
5. Buscar conteúdos aprovados semelhantes
6. Buscar feedback anterior
7. Construir prompt
8. Chamar LLM
9. Validar resposta
10. Salvar geração
```

---

# 22. SOCIAL CONNECTIONS

## 22.1 social_connections

```sql
id UUID PK
agency_id UUID
client_id UUID
platform VARCHAR(50)
external_user_id VARCHAR(255) NULL
external_page_id VARCHAR(255) NULL
account_name VARCHAR(255) NULL
access_token_encrypted TEXT
refresh_token_encrypted TEXT NULL
token_expires_at TIMESTAMP NULL
scopes JSONB
metadata JSONB
status VARCHAR(30)
connected_by UUID
created_at TIMESTAMP
updated_at TIMESTAMP
```

Nunca salvar tokens em texto puro.

Usar criptografia em repouso.

---

# 23. PUBLICAÇÕES

## 23.1 social_publications

```sql
id UUID PK
agency_id UUID
client_id UUID
content_id UUID
content_platform_id UUID
social_connection_id UUID
platform VARCHAR(50)
scheduled_at TIMESTAMP
published_at TIMESTAMP NULL
status VARCHAR(30)
attempts INT DEFAULT 0
external_post_id VARCHAR(255) NULL
external_post_url TEXT NULL
request_payload JSONB NULL
response_payload JSONB NULL
last_error TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

status:

```text
QUEUED
PROCESSING
PUBLISHED
FAILED
CANCELLED
```

---

# 24. ANALYTICS

## 24.1 content_metrics

```sql
id UUID PK
agency_id UUID
client_id UUID
content_id UUID
content_platform_id UUID
platform VARCHAR(50)
metric_date DATE
impressions BIGINT NULL
reach BIGINT NULL
likes BIGINT NULL
comments BIGINT NULL
shares BIGINT NULL
saves BIGINT NULL
clicks BIGINT NULL
video_views BIGINT NULL
watch_time_seconds BIGINT NULL
followers_gained BIGINT NULL
engagement_rate DECIMAL(8,4) NULL
raw_metrics JSONB
created_at TIMESTAMP
updated_at TIMESTAMP

UNIQUE(content_platform_id, metric_date)
```

---

## 24.2 account_metrics

```sql
id UUID PK
agency_id UUID
client_id UUID
social_connection_id UUID
platform VARCHAR(50)
metric_date DATE
followers BIGINT NULL
followers_gained BIGINT NULL
reach BIGINT NULL
impressions BIGINT NULL
engagement BIGINT NULL
profile_views BIGINT NULL
website_clicks BIGINT NULL
raw_metrics JSONB
created_at TIMESTAMP

UNIQUE(social_connection_id, metric_date)
```

---

# 25. RELATÓRIOS

## 25.1 reports

```sql
id UUID PK
agency_id UUID
client_id UUID
period_start DATE
period_end DATE
title VARCHAR(200)
summary TEXT NULL
ai_analysis TEXT NULL
recommendations JSONB NULL
snapshot JSONB
status VARCHAR(30)
public_token VARCHAR(255) UNIQUE NULL
created_by UUID
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 26. NOTIFICAÇÕES

## 26.1 notifications

```sql
id UUID PK
agency_id UUID
user_id UUID
type VARCHAR(100)
title VARCHAR(255)
message TEXT
data JSONB NULL
read_at TIMESTAMP NULL
created_at TIMESTAMP
```

Exemplos:

```text
CONTENT_ASSIGNED
APPROVAL_REQUESTED
APPROVAL_COMPLETED
CHANGES_REQUESTED
PUBLICATION_FAILED
PUBLICATION_SUCCESS
CALENDAR_ENDING
OVERDUE_CONTENT
```

---

# 27. AUDITORIA

## 27.1 audit_logs

```sql
id UUID PK
agency_id UUID
user_id UUID NULL
action VARCHAR(100)
entity_type VARCHAR(100)
entity_id UUID NULL
old_data JSONB NULL
new_data JSONB NULL
ip_address VARCHAR(100) NULL
user_agent TEXT NULL
created_at TIMESTAMP
```

---

# 28. API REST — ESTRUTURA

Prefixo:

```text
/api/v1
```

---

## 28.1 Auth

```http
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
```

---

## 28.2 Agencies

```http
GET    /agencies/current
PATCH  /agencies/current
GET    /agencies/current/members
POST   /agencies/current/members/invite
PATCH  /agencies/current/members/:id
DELETE /agencies/current/members/:id
```

---

## 28.3 Clients

```http
GET    /clients
POST   /clients
GET    /clients/:id
PATCH  /clients/:id
DELETE /clients/:id
```

---

## 28.4 Brand Brain

```http
GET    /clients/:id/brand
PATCH  /clients/:id/brand

GET    /clients/:id/brand/rules
POST   /clients/:id/brand/rules
PATCH  /clients/:id/brand/rules/:ruleId
DELETE /clients/:id/brand/rules/:ruleId

GET    /clients/:id/brand/products
POST   /clients/:id/brand/products

GET    /clients/:id/brand/services
POST   /clients/:id/brand/services

GET    /clients/:id/brand/personas
POST   /clients/:id/brand/personas

GET    /clients/:id/brand/pillars
POST   /clients/:id/brand/pillars

POST   /clients/:id/brand/analyze
POST   /clients/:id/brand/reindex
```

---

## 28.5 Content

```http
GET    /contents
POST   /contents
GET    /contents/:id
PATCH  /contents/:id
DELETE /contents/:id

POST   /contents/:id/duplicate
POST   /contents/:id/change-status

GET    /contents/:id/versions
POST   /contents/:id/versions

GET    /contents/:id/comments
POST   /contents/:id/comments
PATCH  /contents/:id/comments/:commentId
```

---

## 28.6 AI

```http
POST /ai/generate-strategy
POST /ai/generate-calendar
POST /ai/generate-content-ideas
POST /ai/generate-caption
POST /ai/generate-hook
POST /ai/generate-cta
POST /ai/rewrite
POST /ai/analyze-feedback
POST /ai/analyze-performance
POST /ai/generate-report
```

---

## 28.7 Approval

```http
POST /contents/:id/request-approval
GET  /approvals/:token
POST /approvals/:token/approve
POST /approvals/:token/request-changes
POST /approvals/:token/reject
POST /approvals/:token/comments
```

Rotas públicas com token devem ter:
- rate limiting;
- expiração opcional;
- token aleatório longo.

---

## 28.8 Social

```http
GET  /social/connections
POST /social/:platform/connect
GET  /social/:platform/callback
DELETE /social/connections/:id

POST /contents/:id/schedule
POST /contents/:id/publish-now
POST /contents/:id/cancel-publication
```

---

## 28.9 Analytics

```http
GET /analytics/overview
GET /analytics/clients/:id
GET /analytics/clients/:id/content
GET /analytics/contents/:id
POST /analytics/sync
```

---

## 28.10 Reports

```http
GET  /reports
POST /reports
GET  /reports/:id
POST /reports/:id/generate
POST /reports/:id/publish
GET  /public/reports/:token
```

---

# 29. EVENTOS DO SISTEMA

Criar Event Bus interno.

Exemplos:

```text
CLIENT_CREATED
BRAND_UPDATED
BRAND_RULE_CREATED
CONTENT_CREATED
CONTENT_UPDATED
CONTENT_STATUS_CHANGED
CONTENT_APPROVAL_REQUESTED
CONTENT_APPROVED
CONTENT_CHANGES_REQUESTED
CONTENT_SCHEDULED
CONTENT_PUBLISHED
CONTENT_PUBLICATION_FAILED
METRICS_SYNCED
REPORT_GENERATED
```

---

# 30. FILAS BULLMQ

## ai-queue

Jobs:

```text
generate_brand_analysis
generate_strategy
generate_calendar
generate_caption
analyze_feedback
generate_report
```

## social-queue

```text
publish_content
retry_publication
sync_post
```

## analytics-queue

```text
sync_account_metrics
sync_content_metrics
calculate_metrics
```

## notifications-queue

```text
send_email
send_in_app
send_approval_link
```

---

# 31. FLUXO DE ONBOARDING DO CLIENTE

### Passo 1
Criar cliente.

### Passo 2
Adicionar:
- website;
- Instagram;
- Facebook;
- descrição;
- produtos;
- serviços.

### Passo 3
Upload:
- logotipo;
- brand guide;
- materiais;
- catálogo.

### Passo 4
AI Brand Analysis.

Prompt deve retornar JSON estruturado:

```json
{
  "brand_summary": "",
  "positioning": "",
  "target_audience": "",
  "tone_of_voice": "",
  "personas": [],
  "content_pillars": [],
  "recommended_ctas": [],
  "brand_rules": []
}
```

### Passo 5
Humano confirma.

### Passo 6
Salvar informações no Brand Brain.

### Passo 7
Gerar embeddings.

---

# 32. FLUXO DE CRIAÇÃO DO MÊS

Botão:

```text
GERAR CALENDÁRIO COM IA
```

Input:

```text
cliente
mês
quantidade posts
quantidade reels
quantidade stories
objetivos
campanhas
datas especiais
```

IA retorna:

```json
{
  "strategy": {},
  "contents": [
    {
      "date": "2026-09-03",
      "type": "IMAGE",
      "pillar": "EDUCATION",
      "objective": "ENGAGEMENT",
      "title": "",
      "brief": "",
      "hook": "",
      "caption_draft": "",
      "cta": ""
    }
  ]
}
```

Todos entram como:

```text
DRAFT
```

---

# 33. PROMPT BASE DO COPYWRITER

```text
SYSTEM:

Você é um especialista senior em social media e copywriting.

Você está criando conteúdo para a marca abaixo.

BRAND:
{{brand_profile}}

REGRAS:
{{brand_rules}}

PRODUTOS/SERVIÇOS:
{{products_services}}

PERSONAS:
{{personas}}

FEEDBACK ANTERIOR RELEVANTE:
{{retrieved_feedback}}

CONTEÚDOS APROVADOS SEMELHANTES:
{{approved_content}}

Nunca viole as regras da marca.

Se houver conflito entre sugestões gerais e regras da marca,
as regras da marca têm prioridade.
```

---

# 34. APRENDIZAGEM COM FEEDBACK

Exemplo:

Cliente:

```text
"Prefiro que não usemos emojis neste tipo de publicação."
```

Processo:

```text
feedback
  ↓
AI analyze-feedback
  ↓
categoria = COPY
  ↓
instrução normalizada =
"Evitar emojis em publicações institucionais."
  ↓
perguntar/decidir se é global
  ↓
brand_rules
  ↓
embedding
```

No MVP, o sistema pode sugerir:

```text
Deseja transformar este feedback numa regra permanente da marca?
[SIM] [NÃO]
```

---

# 35. PORTAL DE APROVAÇÃO

URL:

```text
/app/approval/{token}
```

Cliente não precisa de login inicialmente.

Página:

```text
[CLIENTE]

Post 03 de Setembro

[PREVIEW]

Legenda:
...

Instagram
Facebook

Comentários:
...

[APROVAR]

[SOLICITAR ALTERAÇÃO]

[REJEITAR]
```

Depois de aprovação:

```text
content.status = APPROVED
```

Se já possuir `scheduled_at`:

```text
criar social_publication
```

---

# 36. CALENDÁRIO

Visualizações:

```text
MONTH
WEEK
LIST
```

Drag and drop:
- mudar data;
- alterar responsável.

Filtros:
- cliente;
- plataforma;
- estado;
- responsável;
- formato.

---

# 37. DASHBOARD

Cards:

```text
Clientes ativos
Conteúdos este mês
Em aprovação
Alterações solicitadas
Atrasados
Agendados
Publicados
Falhas de publicação
```

Bloco:

```text
PRECISA DE ATENÇÃO
```

Exemplos:

```text
Cliente A
Nenhum conteúdo agendado para os próximos 7 dias.

Cliente B
4 conteúdos aguardando aprovação.

Cliente C
Publicação falhou.
```

---

# 38. AI AGENCY MANAGER — MVP LIGHT

Não criar agente complexo inicialmente.

Criar endpoint:

```http
GET /dashboard/attention
```

Com regras:

```text
conteúdo atrasado
aprovação > 3 dias
nenhum conteúdo futuro
publicação com erro
calendário terminando
```

Depois apresentar usando linguagem AI.

---

# 39. ANALYTICS

No MVP, sincronizar:

```text
1x por dia
```

Para posts recentes:

```text
primeiros 7 dias = mais frequente opcional
```

Criar agregados:

```text
engagement_rate =
(likes + comments + shares + saves) / reach
```

Nunca assumir que todas as plataformas possuem as mesmas métricas.

Usar:

```text
raw_metrics JSONB
```

para preservar dados originais.

---

# 40. AI PERFORMANCE ANALYSIS

Entrada:

```json
{
  "period": {},
  "account_metrics": {},
  "top_contents": [],
  "worst_contents": []
}
```

Saída:

```json
{
  "summary": "",
  "wins": [],
  "problems": [],
  "patterns": [],
  "recommendations": [],
  "next_month_experiments": []
}
```

---

# 41. RELATÓRIO

Estrutura:

```text
LOGO CLIENTE

RELATÓRIO
Agosto 2026

1. Resumo executivo

2. Crescimento
- seguidores
- alcance
- impressões
- engagement

3. Conteúdos publicados

4. Top conteúdos

5. Conteúdos com menor desempenho

6. Análise AI

7. Recomendações

8. Plano próximo mês
```

---

# 42. SEGURANÇA

Obrigatório:

- JWT access token curto;
- refresh token;
- hash Argon2 ou bcrypt;
- HTTPS;
- CORS restrito;
- helmet;
- rate limiting;
- validação Zod/class-validator;
- SQL injection protegido via ORM;
- tokens OAuth criptografados;
- logs de auditoria;
- isolamento multi-tenant;
- signed URLs para assets privados;
- limite de tamanho de uploads.

Nunca expor:
- social access token;
- refresh token;
- API keys;
- prompts internos sensíveis.

---

# 43. VARIÁVEIS DE AMBIENTE

```env
NODE_ENV=
APP_URL=
API_URL=

DATABASE_URL=
REDIS_URL=

JWT_SECRET=
JWT_REFRESH_SECRET=

S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=

META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=

ENCRYPTION_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

---

# 44. ESTRUTURA DO BACKEND

```text
src/
  app.module.ts

  common/
    guards/
    decorators/
    filters/
    interceptors/
    pipes/
    utils/

  config/

  modules/
    auth/
    users/
    agencies/
    members/
    clients/
    brand/
    assets/
    strategy/
    calendars/
    content/
    approvals/
    ai/
    social/
    analytics/
    reports/
    notifications/
    audit/

  jobs/
    ai/
    social/
    analytics/
    notifications/

  integrations/
    ai/
      ai-provider.interface.ts
      openai.provider.ts
      anthropic.provider.ts

    social/
      social-provider.interface.ts
      meta.provider.ts

    storage/
      s3.provider.ts

  database/
    prisma/
```

---

# 45. ESTRUTURA DO FRONTEND

```text
src/
  app/
  components/
  layouts/
  hooks/
  lib/
  services/
  stores/
  types/

  features/
    auth/
    dashboard/
    clients/
    brand/
    calendar/
    content/
    approval/
    social/
    analytics/
    reports/
    settings/
```

---

# 46. PÁGINAS

## Auth

```text
/login
/forgot-password
/reset-password
```

## App

```text
/app/dashboard

/app/clients
/app/clients/new
/app/clients/:id
/app/clients/:id/brand
/app/clients/:id/assets
/app/clients/:id/calendar
/app/clients/:id/analytics
/app/clients/:id/reports

/app/calendar

/app/content
/app/content/:id

/app/approvals

/app/social

/app/reports

/app/settings/agency
/app/settings/team
/app/settings/integrations
```

## Público

```text
/approval/:token
/report/:token
```

---

# 47. UI DO CLIENTE

Tabs:

```text
Overview
Brand Brain
Content
Calendar
Assets
Social
Analytics
Reports
Settings
```

---

# 48. CONTENT WORKSPACE

Layout recomendado:

```text
┌───────────────────────────────────────┐
│ Post title                  STATUS    │
├───────────────┬───────────────────────┤
│               │ Brief                 │
│   PREVIEW     │ Hook                  │
│               │ Caption               │
│               │ CTA                   │
│               │ Platforms             │
│               │ Date                  │
├───────────────┴───────────────────────┤
│ COMMENTS / HISTORY / VERSIONS         │
└───────────────────────────────────────┘
```

Botões IA:

```text
Generate
Rewrite
Shorter
More commercial
More premium
Add CTA
Generate hooks
```

---

# 49. MOTOR DE DESIGN — NÃO OBRIGATÓRIO NO MVP 1

Preparar tabelas para futuro.

## design_templates

```sql
id UUID
agency_id UUID
name VARCHAR
canvas_width INT
canvas_height INT
schema JSONB
thumbnail_url TEXT
status VARCHAR
```

`schema` poderia usar:

```json
{
  "elements": [
    {
      "type": "text",
      "key": "headline",
      "x": 50,
      "y": 50,
      "width": 500,
      "style": {}
    }
  ]
}
```

No futuro usar:
- Canvas;
- SVG;
- Fabric.js;
- Konva;
- Puppeteer.

---

# 50. FASES DE IMPLEMENTAÇÃO

---

## FASE 0 — Fundação

Criar:

- monorepo;
- frontend;
- backend;
- Docker;
- PostgreSQL;
- Redis;
- Prisma;
- CI;
- configuração.

Critério:

```text
docker compose up
```

deve iniciar o projeto.

---

## FASE 1 — Auth + Multi-tenant

Implementar:

- users;
- agencies;
- agency_members;
- login;
- JWT;
- roles;
- guards.

Critério:
- utilizador de agência A nunca pode acessar agência B.

---

## FASE 2 — Clientes

Implementar:
- CRUD clientes;
- contactos;
- redes;
- UI.

---

## FASE 3 — Brand Brain

Implementar:
- profile;
- colors;
- fonts;
- products;
- services;
- personas;
- pillars;
- rules;
- feedback memory;
- assets.

---

## FASE 4 — AI Core

Implementar:
- AIProvider;
- prompts;
- structured output;
- logging;
- embeddings;
- RAG.

Primeiros endpoints:
- brand analysis;
- strategy;
- content ideas;
- captions.

---

## FASE 5 — Calendário + Conteúdo

Implementar:
- calendars;
- contents;
- platforms;
- versions;
- comments;
- drag & drop.

---

## FASE 6 — Approval Portal

Implementar:
- approval requests;
- public token;
- approve;
- request changes;
- comments.

---

## FASE 7 — Meta Integration

Implementar:
- OAuth;
- Facebook Pages;
- Instagram Professional;
- conexão;
- publicação;
- jobs;
- retries.

---

## FASE 8 — Analytics

Implementar:
- sync;
- armazenamento;
- overview;
- charts;
- top content.

---

## FASE 9 — Reports

Implementar:
- geração;
- AI analysis;
- public report.

---

## FASE 10 — Dashboard

Implementar:
- indicadores;
- atenção;
- tarefas urgentes.

---

# 51. ORDEM OBRIGATÓRIA PARA O CLAUDE

O Claude não deve tentar criar todo o sistema de uma vez.

Ordem:

```text
1. Fundação
2. Auth
3. Multi-tenant
4. Clientes
5. Brand Brain
6. Assets
7. AI
8. Conteúdo
9. Calendário
10. Aprovação
11. Social
12. Analytics
13. Reports
14. Dashboard
```

Cada fase deve funcionar antes da próxima.

---

# 52. DEFINIÇÃO DE DONE

Uma feature só é considerada concluída quando possui:

- schema;
- migration;
- service;
- controller;
- validação;
- permissions;
- frontend;
- loading;
- error handling;
- empty state;
- testes básicos;
- documentação mínima.

---

# 53. REGRAS PARA O CLAUDE

## Muito importante

1. Não destruir lógica existente.
2. Não substituir módulos funcionais sem necessidade.
3. Não alterar arquitetura sem explicar.
4. Não criar dados mock permanentes.
5. Não deixar TODO em funcionalidades críticas.
6. Não hardcode `agency_id`.
7. Não hardcode tokens.
8. Não expor secrets no frontend.
9. Não implementar bypass de autorização.
10. Usar migrations.
11. Usar TypeScript estrito.
12. Criar interfaces para integrações externas.
13. Separar provider da regra de negócio.
14. Toda ação importante precisa de tratamento de erro.
15. Todas as listas precisam de paginação.
16. Todas as mutations precisam de feedback visual.

---

# 54. REGRAS DE UX

A plataforma deve ser:

```text
clean
premium
profissional
rápida
desktop-first
responsive
```

Evitar:
- excesso de gradients;
- aparência genérica de AI SaaS;
- animações excessivas;
- dashboards poluídos.

Interface inspirada em:
- Linear;
- Notion;
- Stripe;
- HubSpot;
- Monday;
- ClickUp.

Sem copiar visualmente nenhuma delas.

---

# 55. DESIGN SYSTEM

Usar:

```text
4px base spacing
8px
12px
16px
24px
32px
48px
```

Border radius:

```text
8–12px
```

Componentes:

```text
Button
Input
Textarea
Select
Combobox
Modal
Drawer
Dropdown
Tabs
DataTable
Calendar
Badge
Avatar
Card
Toast
Tooltip
Skeleton
Command Palette
```

---

# 56. SEARCH

Pesquisa global futura:

```text
cliente
conteúdo
campanha
produto
ficheiro
```

Preparar índices:

```sql
clients(name)
contents(title)
brand_products(name)
```

---

# 57. ÍNDICES IMPORTANTES

Adicionar índices em:

```text
agency_id
client_id
status
scheduled_at
created_at
platform
```

Exemplo:

```sql
CREATE INDEX idx_contents_agency_status
ON contents(agency_id, status);
```

---

# 58. SOFT DELETE

Usar `deleted_at` para:
- clients;
- contents;
- assets.

Não apagar imediatamente ficheiros críticos.

---

# 59. OBSERVABILIDADE

Logs estruturados:

```json
{
  "request_id": "",
  "agency_id": "",
  "user_id": "",
  "module": "",
  "action": "",
  "duration_ms": 0
}
```

Preparar integração futura:
- Sentry;
- OpenTelemetry.

---

# 60. HEALTH

Endpoints:

```http
GET /health
GET /health/db
GET /health/redis
```

---

# 61. TESTES

## Unitários
- services;
- AI normalization;
- permission checks.

## Integração
- auth;
- client CRUD;
- approval;
- publish queue.

## E2E principais

### Fluxo 1

```text
login
→ criar cliente
→ configurar brand
→ gerar calendário
→ abrir conteúdo
→ gerar legenda
→ enviar aprovação
→ aprovar
```

### Fluxo 2

```text
conteúdo aprovado
→ agendar
→ job
→ social provider
→ published
```

---

# 62. MVP — CRITÉRIOS DE SUCESSO

O produto é considerado um MVP funcional quando uma agência consegue:

1. Criar conta.
2. Criar um cliente.
3. Configurar Brand Brain.
4. Adicionar produtos/serviços.
5. Gerar estratégia via IA.
6. Gerar calendário mensal via IA.
7. Gerar copy.
8. Fazer upload da arte.
9. Enviar para aprovação.
10. Cliente aprovar por link.
11. Agendar conteúdo.
12. Publicar em pelo menos Facebook/Instagram.
13. Recolher métricas.
14. Gerar análise mensal.
15. Compartilhar relatório.

---

# 63. MÉTRICAS DO PRÓPRIO SAAS

Guardar futuramente:

```text
clientes por agência
conteúdos criados
conteúdos AI
aprovações
tempo até aprovação
posts publicados
falhas
tokens AI
custo AI
storage
```

Essas métricas permitirão billing posteriormente.

---

# 64. PLANOS FUTUROS

## Starter
```text
5 clientes
2 membros
AI limitada
```

## Agency
```text
20 clientes
10 membros
AI avançada
```

## Agency Pro
```text
50 clientes
white label
analytics avançado
```

## Enterprise
```text
custom
```

---

# 65. FEATURES FUTURAS

Após MVP:

- TikTok;
- LinkedIn;
- YouTube;
- WhatsApp;
- Social Inbox;
- CRM;
- lead scoring;
- automações;
- AI video;
- AI image;
- template engine;
- competitor monitoring;
- Ad Manager;
- UTM tracking;
- leads por campanha;
- proposals;
- contracts;
- billing;
- client mobile app;
- white-label portal.

---

# 66. VISÃO DO AI AGENT FUTURO

Pergunta:

```text
"O que precisa da minha atenção?"
```

Resposta:

```text
5 situações:

1. Cliente A
Nenhum post agendado para próxima semana.

2. Cliente B
3 conteúdos aguardam aprovação há 4 dias.

3. Cliente C
Publicação falhou.

4. Cliente D
Engagement caiu.

5. Cliente E
Calendário termina em 3 dias.
```

O agente deverá poder executar ações autorizadas:

```text
"Crie o calendário do Cliente A."
```

```text
"Reenvie a aprovação."
```

```text
"Mostre os posts com pior performance."
```

---

# 67. PRINCIPAL DIFERENCIAL

O produto não deve ser vendido como:

> Ferramenta de agendamento.

Posicionamento:

> **Um sistema operacional para agências gerido por IA.**

Mensagem:

```text
Cliente
→ Estratégia
→ Conteúdo
→ Design
→ Aprovação
→ Publicação
→ Analytics
→ Aprendizagem
```

---

# 68. REGRA MAIS IMPORTANTE

O sistema deve ficar mais inteligente quanto mais é utilizado.

Cada:

```text
aprovação
rejeição
comentário
alteração
performance
```

deve contribuir para o conhecimento da marca.

Objetivo final:

```text
MÊS 1
IA conhece pouco.

MÊS 3
IA conhece padrões.

MÊS 6
IA já conhece a marca,
preferências do cliente,
conteúdos que funcionam
e tipos de alterações recorrentes.
```

---

# 69. PROMPT PARA INICIAR A IMPLEMENTAÇÃO NO CLAUDE

Use o seguinte comando juntamente com este documento:

```text
Leia integralmente o arquivo AGENCYFLOW_MVP_PLAN.md antes de escrever código.

Este arquivo é a especificação principal do projeto.

Quero construir o sistema por fases, sem tentar implementar tudo de uma só vez.

Comece SOMENTE pela FASE 0 — Fundação.

Antes de modificar código:

1. Analise o repositório atual.
2. Liste a arquitetura existente.
3. Identifique tecnologias já instaladas.
4. Identifique o que pode ser preservado.
5. Apresente o plano da FASE 0.

Depois execute a fase.

Não avance automaticamente para a fase seguinte.

Regras:

- preserve rotas existentes;
- preserve APIs existentes;
- não remova lógica funcional;
- utilize TypeScript;
- mantenha multi-tenancy como requisito obrigatório;
- não utilize mocks permanentes;
- utilize migrations;
- não exponha secrets;
- todo código deve ser production-ready;
- crie README das decisões relevantes.

Ao finalizar a fase:

1. liste os arquivos criados;
2. liste os arquivos modificados;
3. informe migrations;
4. informe comandos necessários;
5. informe variáveis de ambiente;
6. informe testes realizados;
7. informe pendências.

Aguarde meu comando para iniciar a próxima fase.
```

---

# 70. PROMPT PARA AS FASES SEGUINTES

```text
Continue o projeto AgencyFlow AI conforme AGENCYFLOW_MVP_PLAN.md.

Execute SOMENTE a FASE [NÚMERO].

Antes de codificar:
- revise o que já existe;
- preserve tudo que estiver funcional;
- confira dependências da fase anterior;
- identifique migrations necessárias;
- identifique riscos.

Implemente backend + frontend + validações + permissions + estados de loading/error.

Não avance para outra fase.

Ao concluir:
- entregue resumo técnico;
- arquivos alterados;
- migrations;
- endpoints;
- telas;
- testes;
- pendências.
```

---

# 71. CHECKLIST FINAL DO MVP

- [ ] Auth
- [ ] Agencies
- [ ] Roles
- [ ] Multi-tenant isolation
- [ ] Clients
- [ ] Contacts
- [ ] Social accounts
- [ ] Brand Profile
- [ ] Colors
- [ ] Fonts
- [ ] Products
- [ ] Services
- [ ] Personas
- [ ] Content Pillars
- [ ] Brand Rules
- [ ] Feedback Memory
- [ ] Assets
- [ ] Embeddings
- [ ] RAG
- [ ] AI Provider
- [ ] Strategy Generation
- [ ] Calendar Generation
- [ ] Content
- [ ] Versions
- [ ] Comments
- [ ] Calendar UI
- [ ] Approval Portal
- [ ] Approval History
- [ ] Meta OAuth
- [ ] Instagram publishing
- [ ] Facebook publishing
- [ ] Publish queue
- [ ] Retries
- [ ] Account metrics
- [ ] Content metrics
- [ ] AI performance analysis
- [ ] Reports
- [ ] Public report
- [ ] Dashboard
- [ ] Attention center
- [ ] Notifications
- [ ] Audit logs
- [ ] Security review
- [ ] E2E tests
- [ ] Production deployment

---

# 72. RESULTADO ESPERADO

No final do MVP deve ser possível executar este cenário:

```text
AGÊNCIA CRIA CLIENTE
       ↓
PREENCHE BRIEFING
       ↓
UPLOAD BRAND GUIDE
       ↓
IA CRIA BRAND BRAIN
       ↓
GESTOR CORRIGE/APROVA
       ↓
IA GERA ESTRATÉGIA
       ↓
IA GERA CALENDÁRIO
       ↓
IA GERA COPIES
       ↓
DESIGN É ANEXADO
       ↓
CLIENTE RECEBE LINK
       ↓
CLIENTE SOLICITA ALTERAÇÃO
       ↓
FEEDBACK VAI PARA MEMÓRIA
       ↓
AGÊNCIA CORRIGE
       ↓
CLIENTE APROVA
       ↓
POST É AGENDADO
       ↓
POST É PUBLICADO
       ↓
MÉTRICAS SÃO RECOLHIDAS
       ↓
IA ANALISA
       ↓
RELATÓRIO É GERADO
       ↓
NOVO CALENDÁRIO USA O QUE FOI APRENDIDO
```

---

# FIM DA ESPECIFICAÇÃO DO MVP

Este documento deve ser tratado como a **fonte principal de requisitos** do AgencyFlow AI durante a primeira implementação.
