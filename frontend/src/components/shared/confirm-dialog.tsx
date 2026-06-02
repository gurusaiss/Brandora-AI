'use client'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from './modal'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  isLoading?: boolean
  variant?: 'danger' | 'warning'
}

export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', isLoading = false, variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center gap-5">
        <div className={cn('w-14 h-14 rounded-full flex items-center justify-center', variant === 'danger' ? 'bg-destructive/10' : 'bg-yellow-100 dark:bg-yellow-900/20')}>
          <AlertTriangle className={cn('w-7 h-7', variant === 'danger' ? 'text-destructive' : 'text-yellow-600')} />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={onClose} disabled={isLoading} className="flex-1 h-10 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn('flex-1 h-10 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50', variant === 'danger' ? 'bg-destructive hover:bg-destructive/90' : 'bg-yellow-500 hover:bg-yellow-600')}
          >
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
