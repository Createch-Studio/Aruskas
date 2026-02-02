'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import type { Debt } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { AddDebtDialog } from '@/components/add-debt-dialog'
import { useState } from 'react'

interface DebtTableProps {
  debts: Debt[]
  onRefresh: () => void
}

export function DebtTable({ debts, onRefresh }: DebtTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      pending: { label: 'Belum Dibayar', variant: 'destructive' },
      partial: { label: 'Dibayar Sebagian', variant: 'secondary' },
      paid: { label: 'Lunas', variant: 'default' },
    }
    return variants[status] || { label: status, variant: 'default' }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Utang
        </Button>
      </div>

      <AddDebtDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={onRefresh} />

      {debts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Tidak ada utang
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kreditur</TableHead>
                <TableHead className="text-right">Total Utang</TableHead>
                <TableHead className="text-right">Terbayar</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => {
                const badge = getStatusBadge(debt.status)
                const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && debt.status !== 'paid'
                
                return (
                  <TableRow key={debt.id}>
                    <TableCell>
                      <div className="font-medium">{debt.name}</div>
                      {debt.description && (
                        <div className="text-sm text-muted-foreground">{debt.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(debt.amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(debt.amount - debt.remaining_amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(debt.remaining_amount)}
                    </TableCell>
                    <TableCell className={cn(isOverdue && 'text-destructive font-medium')}>
                      {debt.due_date ? new Date(debt.due_date).toLocaleDateString('id-ID') : '-'}
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
