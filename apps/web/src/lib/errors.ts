// The backend's error handler (see apps/api `errorHandler.ts`) only ever puts a message on
// `response.data.error` when it's an intentional, user-safe message (AppError subclasses,
// or a handful of mapped Prisma codes) — anything unexpected is replaced server-side with a
// generic "Internal server error" before it ever reaches the client. So it's always safe to
// show `response.data.error` verbatim; we never construct messages from raw `err.message`,
// which could contain internal details the backend never intended to expose.
export function getErrorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente em instantes.'): string {
  if (err && typeof err === 'object') {
    const anyErr = err as any
    if (anyErr.code === 'ERR_NETWORK' || anyErr.message === 'Network Error') {
      return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
    }
    const backendMessage = anyErr.response?.data?.error
    if (typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage
    }
  }
  return fallback
}
