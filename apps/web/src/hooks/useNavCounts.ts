import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export type NavCounts = { pendingApprovals: number; activeClients: number }

/** Counters shown in the navigation (sidebar + phone tab bar). One shared, cached request. */
export function useNavCounts() {
  const { data } = useQuery({
    queryKey: ['nav', 'counts'],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<NavCounts>('/dashboard/overview', { signal })
      return { pendingApprovals: data.pendingApprovals || 0, activeClients: data.activeClients || 0 }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  })
  return data ?? { pendingApprovals: 0, activeClients: 0 }
}
