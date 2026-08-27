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
}

export const STATUS_COLORS: Record<string, string> = {
  IDEA: 'bg-slate-100 text-slate-600',
  DRAFT: 'bg-gray-100 text-gray-600',
  IN_PRODUCTION: 'bg-blue-50 text-blue-700',
  INTERNAL_REVIEW: 'bg-purple-50 text-purple-700',
  CLIENT_REVIEW: 'bg-amber-50 text-amber-700',
  CHANGES_REQUESTED: 'bg-orange-50 text-orange-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  SCHEDULED: 'bg-cyan-50 text-cyan-700',
  PUBLISHED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-slate-50 text-slate-500',
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
}

export const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#1877F2',
  INSTAGRAM: '#E4405F',
  LINKEDIN: '#0A66C2',
  TIKTOK: '#000000',
  YOUTUBE: '#FF0000',
  X: '#1DA1F2',
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
