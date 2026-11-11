# AgencyOS — Design System

The project-specific layer for the design skills (bencium-controlled-ux-designer, design-audit,
ui-typography, ui-ux-pro-max, mobile-app-ui-design). Universal rules (4px spacing scale, WCAG AA,
touch targets) come from the skills; this file records what is specific to AgencyOS. Source of truth
for values is the code: `apps/web/tailwind.config.ts` and `apps/web/src/index.css`.

## Product

- Operating system for marketing agencies: clients, content planner, approvals, ads, reports, Brand Brain (AI).
- Multi-tenant: every agency configures its own integrations in the dashboard (never server env vars).
- Surfaces: desktop web (sidebar + header) and the Android app (Capacitor, live-updated web).
- Language: Portuguese (pt-BR copy; Mozambique market). Sentence case for headings and buttons.

## Brand personality

Calm, competent, operational. Dense where data matters, quiet everywhere else. No decorative
gradients except the brand green on hero/banner and the Brand Brain card.

## Color

| Token | Value | Use |
|---|---|---|
| primary | `#00A76F` | Primary buttons, active states, focus, FAB |
| primary-dark | `#007867` | Text/icons on light surfaces, hover |
| primary-darker | `#004B50` | Gradient start (banner, login, Brand Brain) |
| primary-light / lighter | `#5BE49B` / `#C8FAD6` | Accents on dark/green surfaces |
| background (light/dark) | `#F3F3F3` / `#202020` | Canvas |
| card (light/dark) | `#FFFFFF` / `#2B2B2B` | Surfaces |
| success / warning / error / info | Minimals palette | Status only — never decoration |

Rules: 60/30/10 (neutral canvas, text, green accent). Red only for failures/destructive actions.
Platform brand colors only on platform icons (Meta, Google, TikTok, LinkedIn, WhatsApp…). In navigation they are
monochrome and take the brand color only when active.
Trend chips on volume metrics (contents created/published) are neutral; red trend only where a drop is a failure.

## Typography

- Family: **Inter** (400–700), fallbacks system-ui/Roboto. One family everywhere.
- Scale in use: page title 22–26px semibold · section title 16–17px semibold · body 14px · meta 12–13px · micro 11px (uppercase labels, badges). Never below 11px.
- Numbers: `tabular-nums` for KPIs, tables and money. Compact axis ticks (`80 mil`, `1,2 mi`).
- Ellipsis `…`, loading states end with `…`.

## Shape, elevation, spacing

- Radius: cards/panels `20px`, inputs/buttons `8–12px` (`rounded-lg`/`rounded-xl`), pills/avatars full.
- Client and agency logos: **always circular**, image `object-cover`; fallback = initials on a tinted circle.
- Shadows: soft, tinted (`shadow-card`, `shadow-card-hover`, green-tinted on primary/FAB).
- Spacing: 4px grid. Page padding 16 / 24 / 32px (mobile / tablet / desktop). Content left-aligned with the header, max width 1920px.

## Components (shared — reuse, don't re-create)

Page/PageHeader · Panel/PanelHeader · KpiCard (icon, badge, label, value, sparkline — **no caption text under the number**) · Stat/StatGroup · MetricExplorer (selectable KPI tiles drive the chart) · AreaChart · DonutChart · FilterBar (pills with counts + search) · FilterMenu · ViewToggle · Segmented · ListCard/Meta · Dialog (bottom sheet on phones) · ConfirmDialog · Toaster · CredentialSettingsRow · PageFab · global search (Ctrl/⌘ K) · PanelEmpty (empty state for panels: soft icon in a
48px rounded tile + one-line title + one sentence + optional outline action; never a lone grey sentence).
Loading = skeleton shaped like the page (never a plain "Carregando…" card).

## Mobile / Android app

- Edge to edge (`viewport-fit=cover`); safe areas via `--sat` / `--sab`.
- Bottom tab bar, 5 slots: Início · Conteúdos · Clientes · Aprovações · Mais (active = tinted pill).
- Create = floating round button (PageFab) only on pages that create something.
- System back gesture/button handles navigation (closes layers → drawer → previous screen → background app). No in-page "Voltar" on phones.
- Touch targets 48dp in the header, ≥44px everywhere; tap feedback via opacity (no tap highlight).
- Tables become cards on phones. Planner opens on the week view; month calendar on demand.

## Content & data rules

- Never invent metrics: only show what the APIs return; empty states explain and offer the next action.
- Creatives in the library: square frame, full creative visible; Stories/Reels show a play badge.
- Dates/numbers through `Intl` / date-fns `ptBR`.
