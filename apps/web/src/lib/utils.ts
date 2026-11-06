import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy') {
  return format(new Date(date), fmt, { locale: ptBR })
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export const STATUS_LABELS: Record<string, string> = {
  IDEA: 'Ideia',
  DRAFT: 'Rascunho',
  IN_PRODUCTION: 'Em Produção',
  INTERNAL_REVIEW: 'Revisão Interna',
  CLIENT_REVIEW: 'Aguardando Cliente',
  CHANGES_REQUESTED: 'Alterações Solicitadas',
  APPROVED: 'Aprovado',
  SCHEDULED: 'Agendado',
  PUBLISHED: 'Publicado',
  FAILED: 'Falhou',
  ARCHIVED: 'Arquivado',
  // Approval links
  PENDING: 'Pendente',
  VIEWED: 'Visualizado',
  REJECTED: 'Rejeitado',
  EXPIRED: 'Expirado',
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  IMAGE: 'Imagem',
  CAROUSEL: 'Carrossel',
  REEL: 'Reel',
  STORY: 'Story',
  VIDEO: 'Vídeo',
  TEXT: 'Texto',
  ARTICLE: 'Artigo',
}

export const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  X: 'X (Twitter)',
  WHATSAPP: 'WhatsApp',
}

export const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#0866FF',
  INSTAGRAM: '#E4405F',
  LINKEDIN: '#0A66C2',
  TIKTOK: '#000000',
  YOUTUBE: '#FF0000',
  X: '#1DA1F2',
  WHATSAPP: '#25D366',
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  DESIGNER: 'Designer',
  COPYWRITER: 'Copywriter',
  CLIENT: 'Cliente',
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
