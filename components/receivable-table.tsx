'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import type { Receivable } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { AddReceivableDialog } from '@/components/add-receivable-dialog'
import { useState } from 'react'

interface ReceivableTableProps {
  receivables: Receivable[]
  onRefresh: () => void
}

export function ReceivableTable({ receivables, onRefresh }: ReceivableTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      pending: { label: 'Belum Diterima', variant: 'destructive' },
      partial: { label: 'Diterima Sebagian', variant: 'secondary' },
      received: { label: 'Lunas', variant: 'default' },
    }
    return variants[status] || { label: status, variant: 'default' }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Piutang
        </Button>
      </div>

      <AddReceivableDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={onRefresh} />

      {receivables.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Tidak ada piutang
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debitur</TableHead>
                <TableHead className="text-right">Total Piutang</TableHead>
                <TableHead className="text-right">Diterima</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((receivable) => {
                const badge = getStatusBadge(receivable.status)
                const isOverdue = receivable.due_date && new Date(receivable.due_date) < new Date() && receivable.status !== 'received'
                
                return (
                  <TableRow key={receivable.id}>
                    <TableCell>
                      <div className="font-medium">{receivable.name}</div>
                      {receivable.description && (
                        <div className="text-sm text-muted-foreground">{receivable.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(receivable.amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(receivable.amount - receivable.remaining_amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCurrency(receivable.remaining_amount)}
                    </TableCell>
                    <TableCell className={cn(isOverdue && 'text-destructive font-medium')}>
                      {receivable.due_date ? new Date(receivable.due_date).toLocaleDateString('id-ID') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
