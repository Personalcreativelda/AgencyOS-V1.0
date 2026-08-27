import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, FileText, CheckCircle2, Clock, AlertTriangle,
  Calendar, ArrowUpRight, Sparkles, Plus, CheckSquare
} from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar'

const PRIORITY_STYLES: Record<string, { dot: string; avatar: string }> = {
  HIGH: { dot: 'bg-error', avatar: 'bg-error/15 text-error-dark' },
  MEDIUM: { dot: 'bg-warning', avatar: 'bg-warning/15 text-warning-dark' },
  LOW: { dot: 'bg-info', avatar: 'bg-info/15 text-info-dark' },
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [overview, setOverview] = useState<any>(null)
  const [attention, setAttention] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [ovRes, attRes] = await Promise.all([
          api.get('/dashboard/overview'),
          api.get('/dashboard/attention'),
        ])
        setOverview(ovRes.data)
        setAttention(attRes.data.items || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const kpis = [
    { label: 'Clientes Ativos', value: overview?.activeClients || 0, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Conteúdos este Mês', value: overview?.totalContentsThisMonth || 0, icon: FileText, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Aguardando Aprovação', value: overview?.pendingApprovals || 0, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Alterações Solicitadas', value: overview?.changesRequested || 0, icon: AlertTriangle, color: 'text-error', bg: 'bg-error/10' },
    { label: 'Conteúdos Agendados', value: overview?.scheduledContents || 0, icon: Calendar, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Publicados este Mês', value: overview?.publishedThisMonth || 0, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Conteúdos Atrasados', value: overview?.overdueContents || 0, icon: Clock, color: 'text-error', bg: 'bg-error/10' },
    { label: 'Falhas de Publicação', value: overview?.failedPublications || 0, icon: AlertTriangle, color: 'text-error', bg: 'bg-error/10' },
  ]

  return (
    <div className="p-4 sm:p-8 space-y-8">
      {/* Welcome Banner — fixed black/white premium look, same contrast in light or dark mode */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a0a0a] via-[#161616] to-[#0a0a0a] p-6 sm:p-8 text-[#fff] shadow-z16 border border-[#fff]/10">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-[#fff]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-xl space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-[#fff]/10 border border-[#fff]/10 text-xs font-bold backdrop-blur-md">
            ✨ AgencyOS v1.0
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Bem-vindo de volta, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-[#fff]/70 leading-relaxed font-medium">
            Seu sistema de automação para agências com inteligência de marca (Brand Brain).
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <Button asChild variant="ghost" className="px-4 py-2 bg-[#fff] hover:bg-[#e8e8e8] text-[#0a0a0a] hover:text-[#0a0a0a] shadow-z8">
              <Link to="/app/clients/new">
                <Plus size={16} />
                <span>Novo Cliente</span>
              </Link>
            </Button>

            <Button asChild variant="ghost" className="px-4 py-2 bg-[#fff]/10 hover:bg-[#fff]/20 text-[#fff] hover:text-[#fff] backdrop-blur-md border border-[#fff]/20">
              <Link to="/app/content">
                <Sparkles size={16} />
                <span>Criar Conteúdo com IA</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi, index) => (
          <Card key={index} hover className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                {kpi.label}
              </p>
              <h3 className="text-3xl font-extrabold text-foreground tracking-tight tabular-nums mt-1.5">
                {kpi.value}
              </h3>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${kpi.bg}`}>
              <kpi.icon className={`w-7 h-7 ${kpi.color}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Attention & Action Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Needs Attention Block (8 cols) */}
        <Card className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-foreground tracking-tight">Precisa da sua Atenção</h2>
                <p className="text-xs text-muted-foreground font-medium">Alertas em tempo real com base nos prazos e feedbacks</p>
              </div>
            </div>
            <Badge variant="warning">{attention.length} pendências</Badge>
          </div>

          {attention.length === 0 ? (
            <div className="py-12 text-center border border-border rounded-2xl bg-grey-200/40">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-foreground">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Não há conteúdos atrasados ou aprovações pendentes críticas.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {attention.map((item, idx) => {
                const style = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.LOW
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-4 bg-grey-200/60 hover:bg-grey-200 rounded-2xl border border-grey-200 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        {item.clientLogoUrl && <AvatarImage src={item.clientLogoUrl} />}
                        <AvatarFallback className={`${style.avatar} text-xs font-extrabold`}>
                          {getInitials(item.clientName || '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-grey-800 leading-snug">{item.message}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                          <p className="text-[11px] text-grey-500 font-semibold truncate">{item.clientName}</p>
                        </div>
                      </div>
                    </div>

                    <Button asChild variant="ghost" size="icon" className="shrink-0 bg-card/80 hover:bg-card shadow-sm">
                      <Link to={item.contentId ? `/app/content/${item.contentId}` : `/app/clients/${item.clientId}`}>
                        <ArrowUpRight size={16} />
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Quick Launchpad (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Brand Brain Card */}
          <Card className="space-y-4 bg-primary/5 border-primary/15">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#fff]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-foreground tracking-tight">Brand Brain IA</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Memória adaptativa de cada cliente</p>
              </div>
            </div>
            <p className="text-xs text-foreground/70 leading-relaxed font-medium">
              O AgencyOS aprende as regras, público e preferências de cada cliente com base nas aprovações e feedbacks.
            </p>
            <Link
              to="/app/clients"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
            >
              <span>Gerenciar memórias de marca</span>
              <ArrowUpRight size={14} />
            </Link>
          </Card>

          {/* Quick Actions Card */}
          <Card className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Ações Rápidas</h3>
            <div className="space-y-1.5">
              <Button asChild variant="ghost" className="w-full justify-start gap-3 p-3 text-foreground/80 hover:text-foreground">
                <Link to="/app/calendar">
                  <Calendar size={16} className="text-primary" />
                  <span>Calendário Editorial</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start gap-3 p-3 text-foreground/80 hover:text-foreground">
                <Link to="/app/approvals">
                  <CheckSquare size={16} className="text-warning" />
                  <span>Links de Aprovação do Cliente</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start gap-3 p-3 text-foreground/80 hover:text-foreground">
                <Link to="/app/reports">
                  <FileText size={16} className="text-info" />
                  <span>Gerar Relatório Mensal</span>
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
