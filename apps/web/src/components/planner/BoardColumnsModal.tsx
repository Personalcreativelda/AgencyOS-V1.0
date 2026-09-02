import { useEffect, useState } from 'react'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { EffectiveBoardColumn, KanbanColumnConfig } from './plannerUtils'

interface BoardColumnsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialColumns: EffectiveBoardColumn[]
  onSave: (overrides: KanbanColumnConfig[]) => Promise<void>
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function ColumnRow({ column, onLabelChange, onToggleHidden }: {
  column: EffectiveBoardColumn
  onLabelChange: (value: string) => void
  onToggleHidden: () => void
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: column.key })
  const { setNodeRef: setDropRef } = useDroppable({ id: column.key })

  return (
    <div
      ref={setDropRef}
      className={cn(
        'flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border transition-opacity',
        isDragging && 'opacity-40'
      )}
    >
      <div
        ref={setDragRef}
        {...listeners}
        {...attributes}
        style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
        className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 p-1 touch-none"
      >
        <GripVertical size={15} />
      </div>
      <Input
        value={column.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="h-9 py-1.5 text-xs"
      />
      <button
        type="button"
        title="Ocultar coluna"
        onClick={onToggleHidden}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <EyeOff size={15} />
      </button>
    </div>
  )
}

export function BoardColumnsModal({ open, onOpenChange, initialColumns, onSave }: BoardColumnsModalProps) {
  const [columns, setColumns] = useState<EffectiveBoardColumn[]>(initialColumns)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setColumns(initialColumns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const visible = columns.filter((c) => !c.hidden)
  const hidden = columns.filter((c) => c.hidden)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setColumns((cs) => {
      const visibleKeys = cs.filter((c) => !c.hidden).map((c) => c.key)
      const from = visibleKeys.indexOf(String(active.id))
      const to = visibleKeys.indexOf(String(over.id))
      if (from === -1 || to === -1) return cs

      const visibleCols = cs.filter((c) => !c.hidden)
      const hiddenCols = cs.filter((c) => c.hidden)
      return [...arrayMove(visibleCols, from, to), ...hiddenCols]
    })
  }

  const updateColumn = (key: string, patch: Partial<EffectiveBoardColumn>) => {
    setColumns((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const visibleOrdered = columns.filter((c) => !c.hidden)
      const hiddenCols = columns.filter((c) => c.hidden)
      const overrides: KanbanColumnConfig[] = [...visibleOrdered, ...hiddenCols].map((c, i) => ({
        key: c.key,
        label: c.label,
        order: i,
        hidden: c.hidden,
      }))
      await onSave(overrides)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Personalizar Colunas do Kanban</DialogTitle>
        <DialogDescription>
          Renomeie, reordene ou oculte colunas. Ocultar não apaga conteúdos — eles continuam
          disponíveis em Lista e Calendário, e a coluna pode ser restaurada a qualquer momento.
        </DialogDescription>

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Colunas visíveis</p>
          <DndContext onDragEnd={handleDragEnd}>
            <div className="space-y-2">
              {visible.map((column) => (
                <ColumnRow
                  key={column.key}
                  column={column}
                  onLabelChange={(value) => updateColumn(column.key, { label: value })}
                  onToggleHidden={() => updateColumn(column.key, { hidden: true })}
                />
              ))}
            </div>
          </DndContext>
        </div>

        {hidden.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Colunas ocultas</p>
            <div className="space-y-2">
              {hidden.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/20 border border-border">
                  <span className="text-xs font-bold text-muted-foreground truncate">{column.label}</span>
                  <button
                    type="button"
                    onClick={() => updateColumn(column.key, { hidden: false })}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary-dark transition-colors shrink-0"
                  >
                    <Eye size={13} />
                    <span>Restaurar</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" loading={saving} onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
