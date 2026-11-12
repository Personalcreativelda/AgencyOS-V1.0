/**
 * Errors shown to people are always clear Portuguese that says what went wrong and what to do.
 * Technical details (stack traces, English API/database messages, HTML error pages) never reach
 * the screen — they go to the console for the development team.
 */

/** An error whose message is already written for the user (e.g. "A imagem tem 7,2 MB…"). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

// Known backend messages that are still in English, translated.
const KNOWN: Record<string, string> = {
  'invalid email or password': 'Email ou senha incorretos.',
  'account is inactive': 'Esta conta está desativada. Fale com o administrador da agência.',
  'no active agency found': 'Esta conta não pertence a nenhuma agência ativa.',
  'a record with this value already exists.': 'Já existe um registo com estes dados.',
  'record not found.': 'Não encontrámos este item. Pode ter sido apagado.',
}

const BY_STATUS: Record<number, string> = {
  400: 'Alguns dados estão em falta ou não são válidos. Verifique o formulário e tente novamente.',
  401: 'A sua sessão expirou. Entre novamente.',
  403: 'Não tem permissão para fazer esta ação.',
  404: 'Não encontrámos este item. Pode ter sido apagado.',
  408: 'O servidor demorou demasiado a responder. Tente novamente.',
  409: 'Este item foi alterado entretanto. Atualize a página e tente novamente.',
  413: 'O ficheiro é demasiado grande para enviar. Reduza o tamanho (imagens até 5 MB, vídeos até 100 MB) e tente novamente.',
  415: 'Este tipo de ficheiro não é suportado. Use JPG, PNG, WEBP, GIF, MP4, MOV ou WEBM.',
  429: 'Muitas tentativas seguidas. Aguarde um momento e tente novamente.',
}
const SERVER = 'O servidor teve um problema ao processar o pedido. Tente novamente em instantes; se continuar, contacte o suporte.'
const NETWORK = 'Não foi possível ligar ao servidor. Verifique a sua internet e tente novamente.'

/** True when a message reads like it was written for people (Portuguese), not a dev message. */
function isUserFacing(message: string) {
  if (!message || message.length > 400) return false
  if (/<html|<!doctype|prisma|stack|ECONN|ETIMEDOUT|TypeError|ReferenceError|undefined|\bnull\b|unexpected token|internal server error|request failed with status/i.test(message)) return false
  return /[ãõçáéíóúâêôà]/i.test(message) || /\b(não|nao|de|para|com|um|uma|seu|sua|verifique|tente|configure|erro|limite)\b/i.test(message)
}

/** Turns any error (axios, fetch, thrown) into one clear sentence for the user. */
export function friendlyMessage(err: unknown, fallback = 'Algo correu mal. Tente novamente em instantes.'): string {
  if (err instanceof UserFacingError) return err.message
  if (!err || typeof err !== 'object') return fallback
  const anyErr = err as any
  if (anyErr.friendlyMessage) return anyErr.friendlyMessage
  if (anyErr.code === 'ERR_CANCELED') return fallback
  if (!anyErr.response && (anyErr.code === 'ERR_NETWORK' || anyErr.message === 'Network Error' || anyErr.code === 'ECONNABORTED')) {
    return anyErr.code === 'ECONNABORTED' ? BY_STATUS[408] : NETWORK
  }
  const status: number | undefined = anyErr.response?.status
  const data = anyErr.response?.data
  const backend = typeof data?.error === 'string' ? data.error.trim() : typeof data?.message === 'string' ? data.message.trim() : ''
  const known = KNOWN[backend.toLowerCase()]
  if (known) return known
  if (status === 413) return BY_STATUS[413]
  if (backend && isUserFacing(backend)) return backend
  if (status && status >= 500) return SERVER
  if (status && BY_STATUS[status]) return BY_STATUS[status]
  return fallback
}

/** Kept for existing callers. */
export function getErrorMessage(err: unknown, fallback = 'Algo correu mal. Tente novamente em instantes.'): string {
  return friendlyMessage(err, fallback)
}

// ---- Upload limits, checked before sending so the user knows immediately which file is the problem.
export const MAX_IMAGE_MB = 5
export const MAX_VIDEO_MB = 100
const ALLOWED = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm)|application\/pdf)$/

const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** Throws a UserFacingError naming the first file that can't be sent and why. */
export function assertUploadable(files: File[] | FileList) {
  for (const file of Array.from(files)) {
    if (file.type && !ALLOWED.test(file.type)) {
      throw new UserFacingError(`"${file.name}" não é um formato suportado. Use JPG, PNG, WEBP, GIF, MP4, MOV ou WEBM.`)
    }
    const video = file.type.startsWith('video/')
    const limit = video ? MAX_VIDEO_MB : MAX_IMAGE_MB
    if (file.size > limit * 1024 * 1024) {
      throw new UserFacingError(
        `"${file.name}" tem ${mb(file.size)} MB e o limite para ${video ? 'vídeos' : 'imagens'} é ${limit} MB. ` +
        (video ? 'Comprima o vídeo e tente novamente.' : 'Exporte em JPG ou comprima a imagem (ex.: TinyPNG) e tente novamente.'))
    }
  }
}
