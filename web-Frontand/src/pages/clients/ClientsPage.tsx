import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Building2, User, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export function ClientsPage() {
  const [searchParams] = useSearchParams()
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) setSearch(q)
  }, [searchParams])

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/clients', { params: { search } })
        setClients(data.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [search])

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Clientes & Marcas</h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Gerencie as marcas, seus Brand Brains e conteúdos associados.
          </p>
        </div>

        <Button asChild className="self-start">
          <Link to="/app/clients/new">
            <Plus size={16} />
            <span>Cadastrar Cliente</span>
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="max-w-md flex-1">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do cliente..."
            icon={<Search />}
            className="shadow-sm"
          />
        </div>
      </div>

      {/* Clients Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum cliente encontrado"
          description="Adicione o primeiro cliente da sua agência para começar a criar estratégias com IA."
          action={
            <Button asChild>
              <Link to="/app/clients/new">
                <Plus size={16} />
                <span>Adicionar Cliente</span>
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client) => (
            <Link
              key={client.id}
              to={`/app/clients/${client.id}`}
              className="card-minimals-hover p-6 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary-dark font-extrabold flex items-center justify-center text-sm border border-primary/20 shrink-0 overflow-hidden">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.name} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(client.name)
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {client.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-medium">{client.industry || 'Setor não informado'}</p>
                    </div>
                  </div>

                  <Badge variant={client.status === 'ACTIVE' ? 'success' : 'default'}>
                    {client.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                  </Badge>
                </div>

                <p className="text-xs text-grey-600 line-clamp-2 mt-2 leading-relaxed font-medium">
                  {client.description || 'Sem descrição cadastrada.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium">
                  <User size={14} className="text-muted-foreground" />
                  <span>{client.accountManager?.name || 'Sem gestor'}</span>
                </div>

                <div className="flex items-center gap-1 font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                  <span>Brand Brain</span>
                  <ChevronRight size={15} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
