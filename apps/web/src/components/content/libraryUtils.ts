export type CreativeAsset = { id: string; publicUrl: string; mimeType: string; name?: string }
export type LibraryContent = {
  id: string; title: string; contentType: string; status: string; caption?: string | null
  scheduledAt?: string | null; createdAt?: string; updatedAt?: string
  client?: { id: string; name: string }
  platforms?: { id: string; platform: string }[]
  assets?: { id: string; role: string; sortOrder?: number; asset: CreativeAsset | null }[]
}
export type LibrarySort = 'recent' | 'updated' | 'title' | 'scheduled'

export function getCreativeMedia(content: LibraryContent): CreativeAsset[] {
  return (content.assets || []).filter(item => item.role === 'PRIMARY' && item.asset?.publicUrl && /^(image|video)\//.test(item.asset.mimeType))
    .slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(item => item.asset!)
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt')
const timestamp = (value?: string | null) => value ? Date.parse(value) : Number.NaN

export function selectLibraryContents(contents: LibraryContent[], search: string, sort: LibrarySort) {
  const terms = normalize(search.trim()).split(/\s+/).filter(Boolean)
  return contents.filter(content => {
    const text = normalize([content.title, content.client?.name, content.caption].filter(Boolean).join(' '))
    return terms.every(term => text.includes(term))
  }).sort((a, b) => {
    const byName = a.title.localeCompare(b.title, 'pt', { sensitivity: 'base', numeric: true })
    if (sort === 'title') return byName
    if (sort === 'scheduled') {
      const left = timestamp(a.scheduledAt), right = timestamp(b.scheduledAt)
      // Latest date first; missing/invalid dates stay at the end without changing their business status.
      return (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity) || byName
    }
    const key = sort === 'updated' ? 'updatedAt' : 'createdAt'
    return (timestamp(b[key]) || 0) - (timestamp(a[key]) || 0) || byName
  })
}
