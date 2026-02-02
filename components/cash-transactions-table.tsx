'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Pencil, TrendingUp, TrendingDown } from 'lucide-react'
import type { CashTransaction, Cash } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { EditCashTransactionDialog } from '@/components/edit-cash-transaction-dialog'
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

interface CashTransactionsTableProps {
  cashAccounts: Cash[]
  onRefresh: () => void
}

export function CashTransactionsTable({ cashAccounts, onRefresh }: CashTransactionsTableProps) {
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editTransaction, setEditTransaction] = useState<CashTransaction | null>(null)

  const fetchTransactions = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('cash_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    setTransactions((data || []) as CashTransaction[])
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return

    const supabase = createClient()
    const transaction = transactions.find(t => t.id === deleteId)
    if (!transaction) return

    // Delete transaction
    const { error } = await supabase
      .from('cash_transactions')
      .delete()
      .eq('id', deleteId)

    if (!error) {
      // Update cash account balance
      const cashAccount = cashAccounts.find(c => c.id === transaction.cash_id)
      if (cashAccount) {
        const newAmount = transaction.type === 'in'
          ? cashAccount.amount - transaction.amount
          : cashAccount.amount + transaction.amount

        await supabase
          .from('cash')
          .update({ amount: newAmount })
          .eq('id', transaction.cash_id)
      }

      setDeleteId(null)
      await fetchTransactions()
      onRefresh()
    }
  }

  const getCashAccountName = (cashId: string) => {
    const account = cashAccounts.find(c => c.id === cashId)
    return account?.name || '-'
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Memuat...</div>
  }

  if (transactions.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Belum ada transaksi</div>
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Akun</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  {new Date(transaction.transaction_date).toLocaleDateString('id-ID')}
                </TableCell>
                <TableCell>{getCashAccountName(transaction.cash_id)}</TableCell>
                <TableCell>
                  <Badge variant={transaction.type === 'in' ? 'default' : 'secondary'}>
                    {transaction.type === 'in' ? (
                      <><TrendingUp className="mr-1 h-3 w-3" /> Pemasukan</>
                    ) : (
                      <><TrendingDown className="mr-1 h-3 w-3" /> Pengeluaran</>
                    )}
                  </Badge>
                  {transaction.category && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {transaction.category}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {transaction.description || '-'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  <span className={transaction.type === 'in' ? 'text-green-600' : 'text-destructive'}>
                    {transaction.type === 'in' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditTransaction(transaction)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(transaction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditCashTransactionDialog
        open={!!editTransaction}
        onOpenChange={(open) => !open && setEditTransaction(null)}
        transaction={editTransaction}
        cashAccounts={cashAccounts}
        onSuccess={() => {
          fetchTransactions()
          onRefresh()
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus transaksi ini? Saldo akan disesuaikan kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
