# AgencyOS — prompts para o Google Stitch

Guia para gerar no Stitch todas as telas do AgencyOS com qualidade de produto sênior, e depois trazer
os designs para o código (React + Tailwind) deste repositório.

## Como usar

1. **Crie um projeto no Stitch chamado "AgencyOS"** e cole primeiro o **Prompt 0 (Design System)**.
   Ele fixa marca, cores, tipografia e componentes — todas as telas seguintes herdam isso.
2. **Uma tela por prompt.** Cole um bloco de cada vez, na ordem. O Stitch erra muito mais quando
   recebe várias telas juntas.
3. **Desktop primeiro, depois mobile.** Cada tela tem um prompt desktop (1440 px) e um mobile (390 px).
   Gere o mobile *a partir* da tela desktop já aprovada (“Generate mobile version of this screen…”).
4. **Tema claro primeiro.** Quando o claro estiver aprovado, peça a variante escura com o
   **Prompt D (Dark mode)** no fim deste ficheiro.
5. **Ajustes finos:** use os prompts curtos da secção “Refinamento” em vez de reescrever a tela.
6. **Para trazer ao projeto:** exporte cada tela (HTML/Tailwind ou Figma) e peça ao Claude Code
   “aplicar a tela X do Stitch em `apps/web/src/pages/...`” — os componentes já existem
   (Panel, KpiCard, AreaChart, DonutChart, ListCard, Dialog, PageHeader, etc.).

> Todo o texto visível na interface está em **português do Brasil**. Os prompts estão em inglês
> porque o Stitch interpreta melhor — não traduza os textos entre aspas.

---

## Prompt 0 — Design System (cole primeiro)

```
You are designing AgencyOS, a B2B SaaS "operating system" for marketing and advertising agencies.
Agencies use it to manage client brands, plan and approve social media content, publish to
Instagram/Facebook/LinkedIn/TikTok/YouTube/WhatsApp, track Meta Ads / Google Ads / TikTok Ads /
LinkedIn Ads performance and send monthly reports. An AI assistant called "Brand Brain" learns each
client's brand and writes captions, plans months of content and analyses campaigns.

Quality bar: senior product design at the level of Stripe Dashboard, Linear, Vercel and Meta
Business Suite. Calm, dense but breathable, data-first. NOT a generic AI-generated template:
no purple-blue gradients everywhere, no glassmorphism, no emoji, no floating blobs, no giant
illustrations, no fake 3D. Every element must earn its place.

All UI copy in Brazilian Portuguese (pt-BR).

BRAND
- Logo: rounded square (radius 8 on a 40 grid) in #007867 with a white "A" peak drawn as a thick
  rounded stroke and a small mint dot (#C8FAD6) where the crossbar would be. Wordmark "Agency" in
  foreground color + "OS" in #00A76F, semibold.

COLORS (light theme)
- Primary green #00A76F (buttons, active states, links), hover #007867, deep #004B50, mint #C8FAD6
- Page background #F3F3F3, cards #FFFFFF, borders #E4E7EB (hairline), muted surface #F4F6F8
- Text: foreground #1C252E, secondary #637381, tertiary #919EAB
- Semantic: info #00B8D9, success #22C55E, warning #FFAB00, error #FF5630, secondary accent #8E33FF
- Social brand colors only on social logos: Facebook #0866FF, Instagram gradient, LinkedIn #0A66C2,
  YouTube #FF0000, WhatsApp #25D366, TikTok/X black.

TYPOGRAPHY
- Font: "Public Sans" (fallback Inter). Base body 14px/1.5. Scale: 12, 13, 14, 16, 18, 24, 32.
- Page titles 26-32px semibold, tracking -0.02em. Card titles 16-17px semibold. Labels 13-14px
  medium in secondary color. Big numbers (KPIs) 28-32px bold with tabular numbers.
- Sentence case everywhere (never Title Case, never ALL CAPS except tiny table headers).

SHAPE & DEPTH
- Cards: radius 20px, 1px hairline border, very soft shadow (0 1px 2px rgba(145,158,171,.12)).
  Interactive cards darken the border on hover instead of lifting.
- Inputs/selects: 40px tall, radius 12px, 1px border, focus = primary border + 4px soft green ring.
- Buttons: 40px, radius 12px, semibold 14px. Primary solid green; secondary = outline; tertiary = ghost.
- Pills/segmented controls: fully rounded, selected segment filled in near-black (#1C252E) with white text.
- Status badges: small rounded-md chips, 12px semibold, soft tinted background + matching text and a
  6px dot. (Rascunho grey, Em produção blue, Aguardando cliente amber, Alterações solicitadas red,
  Aprovado green, Agendado violet, Publicado green, Falhou red.)
- Icons: Lucide-style line icons, 1.75-2px stroke, 18-20px.

LAYOUT (desktop 1440)
- Left sidebar 264px, white, hairline right border. Top: logo + wordmark (64px tall row).
  Sections with small uppercase 12px labels: "Visão geral" (Dashboard, Performance),
  "Clientes" (Clientes, Aprovações, Relatórios mensais), "Conteúdo" (Conteúdos, Planner, Kanban),
  "Anúncios" (Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads — with the real brand logos),
  "Integrações" (Redes sociais). Footer: Configurações. Items 40px tall, 14px medium, 18px icons;
  active item = soft green background, green text, 3px green bar on the left edge.
  A small round button on the sidebar edge collapses it to a 76px icon rail.
- Top bar 64px: current page title on the left (17px semibold); on the right a theme toggle,
  notifications bell with red count badge, and the user (avatar 40px + name + role "Proprietário" +
  chevron).
- Content max width 1600px, 32px gutters, 24px gap between cards. Cards in the same grid row always
  have equal height.

LAYOUT (mobile 390)
- No sidebar. Top bar 56px: logo + "AgencyOS" wordmark left, bell + avatar right, same background
  as the page (no divider) — like a native app bar.
- Docked bottom navigation bar (Meta Business Suite pattern), full width, white, hairline top
  border, 64px + safe area: "Início" (home), "Conteúdos" (window-with-panels icon), a raised central
  58px green rounded-square "+" button, "Aprovações" (badge with pending count), "Mais" (menu, opens
  the full navigation as a drawer). Active tab: darker icon, bold label, short green bar at the top.
- Modals become bottom sheets with a grab handle; actions stack full-width.
- 16px side gutters, 44px minimum touch targets.

Create a "Design system" screen that shows: logo, color palette with names, type scale, buttons
(primary/outline/ghost/destructive, with loading state), inputs (default/focus/error/disabled),
select, segmented control, status badges, KPI card, list row, empty state, toast, modal and the
mobile bottom navigation bar.
```

---

## 1. Login

**Desktop**
```
Screen: Login for AgencyOS (desktop 1440). Use the AgencyOS design system.
Split layout: left 45% is a brand panel in a deep green gradient (#004B50 → #007867 → #00A76F) with
the AgencyOS logo, the headline "O sistema operacional da sua agência", a 2-line subtitle
"Planeje, aprove e publique conteúdo para todos os clientes — com o Brand Brain aprendendo cada
marca." and 3 small proof points with line icons (Aprovações em 1 clique · Publicação em 6 redes ·
Relatórios automáticos). Subtle concentric rings of the logo "A" as decoration, very low contrast.
Right 55%: centered card-less form, max 400px: title "Entrar na sua agência", subtitle
"Novo usuário? Criar uma agência" (link), fields "Email" and "Senha" (with show/hide eye), a
"Esqueci minha senha" link, primary full-width button "Acessar painel →". Footer small text
"© 2026 AgencyOS". Light theme.
```

**Mobile**
```
Mobile version (390) of the Login screen: no split. Top: logo + wordmark centered, then title,
subtitle, fields and full-width primary button. Keep the brand gradient only as a 180px header band
behind the logo with rounded bottom corners.
```

## 2. Criar agência (registro)

```
Screen: Create agency (desktop 1440), same split layout as Login. Form title "Criar sua agência",
fields: "Nome da agência", "Seu nome completo", "Email", "Senha" (with strength meter), country
select "País / região" (Moçambique, Brasil, Portugal, Angola…). Primary button
"Criar agência e acessar". Below: "Já tem conta? Entrar". Then the mobile version (390).
```

## 3. Dashboard

**Desktop**
```
Screen: Dashboard (desktop 1440), with sidebar + top bar ("Dashboard"). Light theme.
1) Full-width welcome banner, radius 24px, deep green gradient (#004B50 → #007867 → #00A76F),
   faint concentric rings + logo "A" on the right. Text white: small date "Quarta-feira, 11 de
   novembro", title "Bom dia, Ekson" 32px bold, subtitle "Acompanhe a produção, as aprovações e as
   publicações da agência em um só lugar.", then 3 translucent pill chips: "● 5 itens precisam de
   atenção", "Próxima publicação 12 nov às 09:00", "4 clientes ativos". Right side buttons:
   translucent "＋ Novo cliente" and white "✦ Criar conteúdo" (green text).
2) Row of 4 KPI cards (equal height): tinted 48px rounded icon tile on the left; label, big number,
   trend line. "Conteúdos criados 20 ↗ 25% vs 30 dias anteriores", "Publicados 7 ↗ 12,5%",
   "Aguardando aprovação 1 — Em revisão do cliente" (amber number), "Falhas de publicação 3 —
   Rever no centro de atenção" (red number).
3) Row: big card "Produção de conteúdo" (2/3 width) with subtitle, a segmented control
   "30 dias | 90 dias | 12 meses" on the right, a summary line "20 conteúdos criados ↗ 25%" with a
   legend (● Criados green, ● Publicados cyan), and a smooth area chart with soft gradient fill,
   dashed horizontal grid, x labels (days/months), and a hover tooltip card showing the date and both
   values. Right card (1/3) "Próximas publicações" with "Ver todas" link: 4 rows with 56px thumbnail,
   green time "12 nov · 09:00", title, client name + small social icons.
4) Row of 3 equal cards: "Conteúdos por status" (donut 180px with total "20 CONTEÚDOS" in the
   center and a legend with value and %), "Por rede social" (rows: brand logo tile, name, count and a
   thin colored share bar; "Instagram 18 · 2 falhas" in red), "Clientes mais ativos" (avatar, name,
   industry, count in green "20 conteúdos", "Ver todos" link).
5) Row: "Centro de atenção" (2/3) list of alert rows (red/amber icon tile, title, client · detail,
   platform badge, action "Rever publicação ›") with a "5 pendentes" badge; "Atividade recente"
   (1/3) notification feed with relative times.
```

**Mobile**
```
Mobile version (390) of the Dashboard: banner stacks (text then 2 full-width buttons), KPIs in a
2-column grid with icon on top of the number, chart card 220px tall with the segmented control full
width under the title, then Próximas publicações, Status donut, Por rede social, Clientes mais
ativos, Centro de atenção. Docked bottom navigation with central "+" and "Início" active.
```

## 4. Performance

```
Screen: Performance (desktop 1440). Page header: icon tile + "Performance", subtitle "Acompanhe
anúncios, websites e publicações dos seus clientes em um só lugar."; right: client select "Todos
os clientes", period select "Últimos 30 dias", outline button "Atualizar".
Tabs (underline style): Visão geral · Redes sociais · Publicidade · Website / GA4.
"Status das integrações" card: grid of 10 compact tiles (Facebook, Instagram, LinkedIn, TikTok,
YouTube, Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads, GA4) with brand logo, name and a green
"● 2" count when connected or a muted "—" when not.
KPI strip (one card, 4 cells separated by hairlines): Investimento, Impressões, Cliques, Sessões GA4
with small hints. Then a large line chart "Evolução da performance" with metric selector, and a
table "Performance dos clientes" (client, investimento, impressões, cliques, CTR, sessões) with
sortable headers. Then the mobile version (390): tabs scroll horizontally, KPIs 2x2 tiles.
```

## 5. Clientes (lista)

```
Screen: Clientes (desktop 1440). Header "Clientes" + subtitle "As marcas da agência, seus Brand
Brains e conteúdos associados." + primary "＋ Novo cliente". Toolbar: search input "Buscar por nome
do cliente…", filter pills "Todos · Ativos · Pausados", view toggle grid/list.
Grid of client cards (3 per row, equal height): 48px logo, name, industry, status "● Ativo" (green
dot text, no heavy badge), 2-line description, footer with "20 conteúdos" · "Sem gestor" (person
icon) and a chevron. Example clients: "Natur-erva" (Ervanaria), "A Tasca da Nazaré" (Restaurante),
"gologisticservices" (Logística), "Personalcreativelda" (Agência de marketing).
Then the mobile version (390): single-column list rows (logo, name, industry, status dot, chevron).
```

## 6. Novo cliente

```
Screen: Novo cliente (desktop 1440), centered form card max 760px. Header inside the card:
uploadable logo square (dashed, "Enviar logo"), title "Novo cliente", helper "Configure a marca para
inicializar o Brand Brain." Form in 2 columns: "Nome comercial da marca *", "Razão social
(opcional)", "Segmento / indústria", "Website", "Email", "Telefone / WhatsApp", "Gestor da conta"
select, full-width textarea "Descrição & diferenciais do cliente". Footer actions: ghost "Cancelar",
primary "Cadastrar e ativar Brand Brain". Then the mobile version (390), single column.
```

## 7. Detalhe do cliente (Brand Brain)

```
Screen: Client detail (desktop 1440) for "Natur-erva". Header: back arrow, 56px logo, name,
"Ervanaria • Cliente desde 03/09/2026", status "● Ativo", primary button "✦ Análise de marca com
Brand Brain". Contact strip card: Email, Telefone/WhatsApp, Website with an "Editar" ghost button.
Underline tabs: Perfil & Identidade · Personas · Regras da Marca (DO / DONT) · Pilares de Conteúdo ·
Cores, Estilo & Referências · Memória de Feedback.
Show the "Perfil & Identidade" tab: 2-column form — "Resumo da marca", "Tom de voz" (chips:
Próximo, Educativo, Confiável), "Personalidade da marca", "CTA padrão recomendada", "Público
principal" — with a sticky "Salvar alterações" button. Right column: "Brand Brain" card showing a
completeness meter (72%) and suggestions of what to fill next.
```

```
Same client, tab "Cores, Estilo & Referências": color palette editor (5 swatches with hex and role:
Primária, Secundária, Destaque, Texto, Ícones/Bordas), "Estilo visual" textarea, and a masonry grid
of reference images with "＋ Adicionar referência" tile.
```

```
Same client, tab "Memória de Feedback": timeline of client feedback items (quote, author, date,
related content thumbnail) with an action "Transformar em regra permanente no Brand Brain".
Then mobile versions (390) of the client detail: tabs become a horizontally scrollable pill row.
```

## 8. Conteúdos (biblioteca)

```
Screen: Conteúdos (desktop 1440). Header "Conteúdos" + subtitle; actions: outline "✦ Gerar mês com
Brand Brain", primary "＋ Novo conteúdo". Toolbar: segmented "Lista | Grade", filters "Todos os
clientes", "Todos os status", "Todas as redes", search.
List view: one card with hairline-separated rows — 48px thumbnail, title (semibold), meta line
"Natur-erva · Imagem · 03 de set., 09:45 · [instagram][facebook]", status badge on the right, row
hover reveals a trash icon and chevron. Example titles: "AUMENTE O SEU ZINCO", "Aumente sua ingestão
de ômega-3", "ENRIQUEÇA A SUA NUTRIÇÃO", "Ácido Soothe", "Cartaz de Ashwagandha".
Also show the Grade view as a second frame: 5-column square tiles with image, status chip top-right,
dark gradient caption with client, date and platform icons.
Then the mobile version (390): list rows with status under the title; bottom navigation with
"Conteúdos" active.
```

## 9. Planner

```
Screen: Planner (desktop 1440). Header "Planner" + "Visão mensal — arraste um card para
reagendar."; month navigation "‹ Novembro 2026 ›" + "Hoje"; filters. Month calendar grid
(Mon–Sun), each day cell with small content cards (thumbnail, time, platform icons, status chip),
"+2 mais" overflow link, today highlighted with a green circle, hover "＋ Criar" on empty days.
```

```
Mobile Planner (390) in the Meta Business Suite pattern: title "Planner" with primary pill
"Criar"; month label "Novembro 2026 ▾" and week arrows; a 7-day week strip (Seg…Dom) with the
selected day in a filled green circle and a small dot under days that have posts; below, a
day-by-day agenda: big day number + weekday on the left; on the right the posts of that day as
compact cards, or "Nenhuma publicação neste dia" for past days, or "⊕ Toque para criar" for today
and future days. Today's row has a green line with a dot across the top. Bottom navigation visible.
```

## 10. Kanban

```
Screen: Kanban (desktop 1440). Header "Kanban" + "Fluxo de produção — arraste entre colunas para
mudar o status."; button "Personalizar colunas". Horizontal board with columns Rascunho, Em
produção, Revisão interna, Aguardando cliente, Aprovado, Agendado, Publicado — each column with a
colored dot, title and count; cards with thumbnail, time, platform icons, title, client and status.
Empty column shows a dashed "Sem conteúdos" placeholder. Mobile (390): one column at a time with a
horizontal pill selector of columns.
```

## 11. Workspace do conteúdo (editor)

```
Screen: Content workspace (desktop 1440) for "AUMENTE O SEU ZINCO". Header: back arrow, eyebrow
"Natur-erva • Imagem", title, right actions: status select "Publicado", amber "Link de aprovação",
outline "Enviar por WhatsApp", primary "Salvar alterações", trash icon.
Two columns: LEFT (5/12) "Preview social" card with network tabs (Instagram feed, Instagram story,
Facebook, LinkedIn, TikTok, WhatsApp Status) showing a realistic phone-like post preview with the
client avatar, image carousel dots, caption and actions; a "Publicar no Instagram" button under the
preview; media uploader with draggable thumbnails. RIGHT (7/12): editor card with "Título do post",
"Hook / gancho inicial", "Legenda principal" textarea with character counter and a green
"✦ Gerar legenda com Brand Brain" button, suggested hooks as selectable chips, "CTA", "Hashtags",
"Data e hora agendada" (date + hour + minute), "Redes sociais" toggle chips with brand logos,
"Briefing & orientações visuais". Below: "Comentários internos" thread with input.
Mobile (390): preview first, then the editor in collapsible sections, sticky bottom action bar
"Salvar" + overflow menu.
```

## 12. Aprovações

```
Screen: Aprovações (desktop 1440). Header "Aprovações" + "Histórico e status dos links públicos de
aprovação enviados aos clientes."; filter pills "Todos · Pendentes · Visualizados · Aprovados ·
Alterações · Expirados". One list card with rows: title, meta "Natur-erva · Enviado em 13 out.
2026", status badge (Pendente amber, Visualizado blue, Aprovado green, Expirado grey), outline
"Ver portal ↗", trash. A row with status "Alterações solicitadas" expands an amber callout with the
client's quote "Pode trocar a foto por uma com fundo branco?". Mobile (390): rows stack, status
under the title.
```

## 13. Portal de aprovação (público, para o cliente)

```
Screen: public approval portal (mobile-first 390, also desktop 1440 centered 720px). No app
navigation. Top: agency logo + client name "Natur-erva", "Conteúdo para aprovação". The post preview
(Instagram style) large, caption below, schedule "Publicação prevista: 12 nov às 09:00", networks.
Sticky bottom bar with two big buttons: outline "Pedir ajuste" and primary green "Aprovar post".
"Pedir ajuste" opens a bottom sheet with "Seu nome (opcional)" and "O que precisa mudar?" textarea +
"Enviar ajustes". Success state: big green check "Conteúdo aprovado com sucesso!". Footer
"Powered by AgencyOS".
```

## 14. Relatórios mensais

```
Screen: Relatórios mensais (desktop 1440). Header + primary "＋ Gerar relatório". List card rows:
report icon tile, title "Relatório Mensal — Natur-erva", meta "Natur-erva · 30 set. 2026 – 31 out.
2026", "● Publicado" badge, outline "Copiar link", outline "Abrir ↗", trash. Modal "Gerar relatório
com Brand Brain": client select, "Título do relatório", "Data início", "Data fim", primary "Gerar e
publicar". Mobile (390) list + bottom sheet modal.
```

## 15. Relatório público (para o cliente)

```
Screen: public monthly report (desktop 1440, printable A4-friendly, centered 880px). Cover: agency
logo, client logo, "Relatório mensal · Outubro 2026". Executive summary written by Brand Brain in 3
short paragraphs. KPI strip (Alcance, Impressões, Engajamento, Investimento, Resultados) with trend
arrows vs previous month. Charts: reach over time (area), engagement by network (bars), top 3 posts
with thumbnails and metrics. "Recomendações para o próximo período" as numbered cards. Button
"Baixar PDF" top-right (hidden on print). Then the mobile version (390).
```

## 16. Meta Ads

```
Screen: Meta Ads (desktop 1440). Header: Meta logo tile + "Meta Ads" + "Performance sincronizada
da Meta, com sugestões de otimização do Brand Brain."; right: client select. Account bar card:
account name "Gologisticservices · ZAR", sync status "Atualizado há 5 min", outline "Sincronizar",
period segmented "Hoje | 7 dias | 30 dias", campaign filter. KPI strip with 7 cells: Investimento,
Impressões, Cliques, CTR, CPC, Resultados (with info tooltip), Custo/resultado. Card "Onde os
anúncios geram contatos": 5 audience tiles (Alcance, Frequência, Cliques no link, Contatos
iniciados, Contatos/clique) + 3 breakdown cards (Regiões, Públicos, Posicionamentos) with bars.
Table "Campanhas": name, status toggle (Ativa/Pausada), investimento, resultados, CPR, CTR.
Card "Sugestões do Brand Brain": recommendation rows with impact chip and "Aplicar" button.
```

```
Mobile Meta Ads (390) in the Meta Business Suite pattern: header "‹ Meta Ads" + primary pill
"Anunciar"; period dropdown "Últimos 7 dias ▾"; "Resumo dos anúncios" with an ⓘ; sentence
"Gologisticservices investiu ZAR 57,38 em 1 campanha nos últimos 7 dias."; 2x2 light-grey metric
tiles (label + ⓘ, big value, green "↑ 100%" trend); then "Atividade recente dos anúncios" list:
ad thumbnail, "9 NOV · Pausada", campaign name, metrics "Conversas iniciadas 10 · Investido
ZAR 57,38". Bottom navigation visible.
```

## 17. Google Ads & Analytics

```
Screen: Google Ads & Analytics (desktop 1440). Header with Google Ads logo tile; segmented
"Google Ads | Analytics (GA4)". Google Ads view: account select, period, KPI strip (Investimento,
Impressões, Cliques, CTR, CPC, Conversões, Custo/conversão), campaigns table with pause/resume.
Analytics view (second frame): property select, KPI strip (Usuários, Sessões, Visualizações,
Sessões envolvidas, Taxa de envolvimento, Eventos principais), sessions area chart, top channels
list, top pages table. Empty state when not connected: logo, "Conecte uma conta Google Ads",
primary "Conectar conta". Mobile (390) with 2x2 metric tiles.
```

## 18. TikTok Ads / LinkedIn Ads

```
Screen: TikTok Ads (desktop 1440) — same structure as Google Ads: brand logo tile header, client and
account selects, period, KPI strip (Investimento, Impressões, Cliques, CTR, CPC, Conversões),
campaigns table. Also an empty state "Conecte uma conta TikTok Ads". Then the same screen for
LinkedIn Ads (LinkedIn logo, blue accents only on the logo). Mobile (390) versions.
```

## 19. Redes sociais (integrações)

```
Screen: Redes sociais (desktop 1440). Header + subtitle "Conecte as redes de cada cliente e os
canais da agência (WhatsApp e email) para publicar conteúdo e enviar aprovações."
Underline tabs: "Contas da agência" | "Contas do cliente".
Tab "Contas da agência": one card with hairline-separated rows — each row: 40px brand tile, name
("Meta App (Facebook + Instagram)", "LinkedIn App", "TikTok App", "YouTube App", "WhatsApp da
agência", "Email (SMTP)"), helper line ("App ID: 1234…" or "Necessário para conectar…"), status
badge (● Configurado / Não configurado), outline "Configurar"/"Editar", trash.
Tab "Contas do cliente" (second frame): client select, a grid of connect buttons with brand logos
("Conectar Facebook", "Conectar Instagram", "Conectar LinkedIn", "Conectar TikTok", "Conectar
YouTube", "Conectar WhatsApp"), and a list of connected accounts with avatar, handle, network logo,
"● Ativa" and "Desconectar".
Also a wizard modal "Passo 2 de 4 — Criar o app na Meta" with a progress bar, numbered steps,
copyable callback URL field and "Voltar / Continuar". Mobile (390) versions.
```

## 20. Configurações

```
Screen: Configurações (desktop 1440), centered 1000px. Sections as cards: "Agência" (logo upload,
name, slug, "País / região: Moçambique (MZ)", "Idioma padrão: Português (Brasil)", "Editar");
"Membros da equipe" (list rows: avatar, name, email, role select "Proprietário / Administrador /
Gestor / Designer / Copywriter", remove) with "＋ Adicionar membro"; "Integrações de IA" (provider
rows OpenAI / Anthropic / Gemini with masked key "sk-…a1f9", capability chips "Texto", "Imagem",
default task routing selects, "Testar conexão", "Editar") and "＋ Conectar provedor". Mobile (390).
```

## 21. Modais e estados globais

```
Screen: component sheet "Modais" (desktop 1440) showing, side by side:
(1) "Novo conteúdo" modal 520px: icon tile, title, description, fields Cliente, Título do post,
Formato, Redes sociais (logo chips), Data e hora agendada, Briefing inicial; sticky footer
"Cancelar" (outline) + "Abrir Workspace" (primary).
(2) "Gerar mês com Brand Brain" modal 640px: Cliente, Mês, Ano, Posts/Reels/Stories counters,
Redes sociais, Objetivo principal; footer "Gerar mês completo".
(3) Destructive confirmation 420px: red-tinted alert icon, "Excluir conteúdo?", explanation,
"Cancelar" (focused) + red "Excluir".
(4) Toasts: success, error, info.
(5) Empty state, loading skeleton of a list, offline screen "Sem conexão com o AgencyOS" with
"Tentar novamente".
Then the mobile versions (390) of (1) and (3) as bottom sheets with a grab handle.
```

---

## Prompt D — Dark mode (para qualquer tela aprovada)

```
Create the dark theme version of this exact screen. Keep layout and content identical.
Background #202020, cards #262626, raised surfaces #2E2E2E, hairline borders #333333,
text #FAFAFA / secondary #A3A3A3. Primary stays #00A76F (use #5BE49B for green text on dark).
Status chips use 15% tinted backgrounds. No pure black, no glow effects. Shadows almost invisible;
separate surfaces with borders instead.
```

## Refinamento (prompts curtos)

- `Make all cards in the same row equal height and align their headers.`
- `Increase information density by ~15%: reduce vertical padding, keep 44px touch targets.`
- `Replace any decorative gradient or illustration with real data or remove it.`
- `Use tabular numbers for every metric and right-align numeric table columns.`
- `Check contrast: all text must meet WCAG AA (4.5:1). Fix any grey-on-grey.`
- `Show the loading skeleton state of this screen.`
- `Show the empty state of this screen with a helpful action.`
- `Show the error state with a retry action.`
