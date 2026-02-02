'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Cash } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { AddCashDialog } from '@/components/add-cash-dialog'
import { EditCashDialog } from '@/components/edit-cash-dialog'
import { AddCashTransactionDialog } from '@/components/add-cash-transaction-dialog'
import { CashTransactionsTable } from '@/components/cash-transactions-table'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface CashTableProps {
  cash: Cash[]
  onRefresh: () => void
}

export function CashTable({ cash, onRefresh }: CashTableProps) {
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState(false)
  const [editCash, setEditCash] = useState<Cash | null>(null)
  const [deleteCashId, setDeleteCashId] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const getAccountTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      cash: { label: 'Tunai', variant: 'default' },
      bank: { label: 'Bank', variant: 'secondary' },
      'e-wallet': { label: 'E-Wallet', variant: 'outline' },
    }
    return variants[type] || { label: type, variant: 'default' }
  }

  const handleDelete = async () => {
    if (!deleteCashId) return

    const supabase = createClient()
    const { error } = await supabase.from('cash').delete().eq('id', deleteCashId)

    if (error) {
      alert('Gagal menghapus akun kas: ' + error.message)
    } else {
      onRefresh()
    }
    setDeleteCashId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <Button onClick={() => setAddAccountDialogOpen(true)} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Tambah Akun Kas
        </Button>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Transaksi
        </Button>
      </div>

      <AddCashDialog open={addAccountDialogOpen} onOpenChange={setAddAccountDialogOpen} onSuccess={onRefresh} />
      <EditCashDialog open={!!editCash} onOpenChange={(open) => !open && setEditCash(null)} cash={editCash} onSuccess={onRefresh} />
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
                <TableHead className="text-right">Aksi</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditCash(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteCashId(account.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <AlertDialog open={!!deleteCashId} onOpenChange={(open) => !open && setDeleteCashId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun Kas</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus akun kas ini? Semua transaksi terkait juga akan terhapus. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
