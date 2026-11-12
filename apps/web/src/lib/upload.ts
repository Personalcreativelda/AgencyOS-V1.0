import api from './api'
import { assertUploadable } from './errors'

export async function uploadFile(file: File, extra: Record<string, string> = {}) {
  assertUploadable([file])
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'IMAGE')
  Object.entries(extra).forEach(([key, value]) => formData.append(key, value))

  const { data } = await api.post('/assets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { publicUrl: string; id: string }
}
