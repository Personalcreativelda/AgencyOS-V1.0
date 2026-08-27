import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ContentCard } from './ContentCard'
import { capitalize } from './plannerUtils'

interface DayAgendaDialogProps {
  date: Date | null
  items: any[]
  onClose: () => void
  onOpenContent: (id: string) => void
  onCreateAt: (date: Date) => void
}

export function DayAgendaDialog({ date, items, onClose, onOpenContent, onCreateAt }: DayAgendaDialogProps) {
  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{date && capitalize(date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum conteúdo neste dia.</p>
          ) : (
            items.map((item) => <ContentCard key={item.id} content={item} onClick={() => onOpenContent(item.id)} />)
          )}
        </div>

        <Button variant="outline" className="w-full justify-center gap-1.5" onClick={() => date && onCreateAt(date)}>
          <Plus size={14} />
          <span>Criar Conteúdo neste dia</span>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
