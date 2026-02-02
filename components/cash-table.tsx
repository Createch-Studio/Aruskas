'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import type { Cash } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { AddCashTransactionDialog } from '@/components/add-cash-transaction-dialog'
import { CashTransactionsTable } from '@/components/cash-transactions-table'
import { useState } from 'react'

interface CashTableProps {
  cash: Cash[]
  onRefresh: () => void
}

export function CashTable({ cash, onRefresh }: CashTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const getAccountTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      cash: { label: 'Tunai', variant: 'default' },
      bank: { label: 'Bank', variant: 'secondary' },
      'e-wallet': { label: 'E-Wallet', variant: 'outline' },
    }
    return variants[type] || { label: type, variant: 'default' }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Transaksi
        </Button>
      </div>

      <AddCashTransactionDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={onRefresh} cashAccounts={cash} />

      {cash.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Tidak ada akun kas
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Akun</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cash.map((account) => {
                const badge = getAccountTypeBadge(account.account_type)
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(account.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.description || '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Transactions List */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Riwayat Transaksi</h3>
        <CashTransactionsTable cashAccounts={cash} onRefresh={onRefresh} />
      </div>
    </div>
  )
}
