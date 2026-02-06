'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Trash2, Pencil, TrendingUp, TrendingDown, 
  ChevronDown, Loader2, Filter, X, Calendar as CalendarIcon 
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [limit, setLimit] = useState(10)
  const [hasMore, setHasMore] = useState(true)
  
  // States untuk Filter
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editTransaction, setEditTransaction] = useState<CashTransaction | null>(null)

  const fetchTransactions = useCallback(async (
    currentLimit: number, 
    account: string, 
    type: string,
    start: string,
    end: string
  ) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query = supabase
      .from('cash_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(currentLimit + 1)

    // Filter Akun
    if (account !== 'all') query = query.eq('cash_id', account)
    // Filter Tipe
    if (type !== 'all') query = query.eq('type', type)
    // Filter Rentang Tanggal
    if (start) query = query.gte('transaction_date', start)
    if (end) query = query.lte('transaction_date', end)

    const { data, error } = await query

    if (!error && data) {
      if (data.length > currentLimit) {
        setHasMore(true)
        setTransactions(data.slice(0, currentLimit) as CashTransaction[])
      } else {
        setHasMore(false)
        setTransactions(data as CashTransaction[])
      }
    }
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchTransactions(limit, filterAccount, filterType, startDate, endDate)
  }, [limit, filterAccount, filterType, startDate, endDate, fetchTransactions])

  const handleResetFilter = () => {
    setFilterAccount('all')
    setFilterType('all')
    setStartDate('')
    setEndDate('')
    setLimit(10)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const supabase = createClient()
    const transaction = transactions.find(t => t.id === deleteId)
    if (!transaction) return

    const { error } = await supabase.from('cash_transactions').delete().eq('id', deleteId)

    if (!error) {
      const cashAccount = cashAccounts.find(c => c.id === transaction.cash_id)
      if (cashAccount) {
        const newAmount = transaction.type === 'in'
          ? cashAccount.amount - transaction.amount
          : cashAccount.amount + transaction.amount

        await supabase.from('cash').update({ amount: newAmount }).eq('id', transaction.cash_id)
      }
      setDeleteId(null)
      fetchTransactions(limit, filterAccount, filterType, startDate, endDate)
      onRefresh()
    }
  }

  const getCashAccountName = (cashId: string) => {
    return cashAccounts.find(c => c.id === cashId)?.name || '-'
  }

  const isFilterActive = filterAccount !== 'all' || filterType !== 'all' || startDate !== '' || endDate !== ''

  return (
    <div className="space-y-4">
      {/* Panel Filter */}
      <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter Transaksi</span>
          </div>
          {isFilterActive && (
            <Button variant="ghost" size="sm" onClick={handleResetFilter} className="h-8 text-xs text-destructive hover:text-destructive">
              <X className="mr-1 h-3 w-3" /> Bersihkan Filter
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filter Akun */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Akun Kas</Label>
            <Select value={filterAccount} onValueChange={(val) => { setFilterAccount(val); setLimit(10); }}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Semua Akun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Akun</SelectItem>
                {cashAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Tipe */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipe</Label>
            <Select value={filterType} onValueChange={(val) => { setFilterType(val); setLimit(10); }}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="in">Pemasukan</SelectItem>
                <SelectItem value="out">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Tanggal Mulai */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dari Tanggal</Label>
            <div className="relative">
              <Input 
                type="date" 
                className="h-9 bg-background pl-8" 
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setLimit(10); }}
              />
              <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Filter Tanggal Selesai */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sampai Tanggal</Label>
            <div className="relative">
              <Input 
                type="date" 
                className="h-9 bg-background pl-8" 
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setLimit(10); }}
              />
              <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Transaksi */}
      <div className="rounded-md border bg-background shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[120px]">Tanggal</TableHead>
              <TableHead>Akun</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="hidden md:table-cell">Keterangan</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Menyinkronkan data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <p>Tidak ada transaksi yang sesuai dengan filter.</p>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs font-medium">
                    {new Date(transaction.transaction_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">{getCashAccountName(transaction.cash_id)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Badge variant={transaction.type === 'in' ? 'default' : 'secondary'} className="w-fit text-[9px] px-1 py-0 uppercase leading-relaxed">
                        {transaction.type === 'in' ? 'Masuk' : 'Keluar'}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground mt-1 font-medium">{transaction.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs max-w-[180px] truncate">
                    {transaction.description || '-'}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    <span className={transaction.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                      {transaction.type === 'in' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => setEditTransaction(transaction)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => setDeleteId(transaction.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {hasMore && (
        <div className="flex justify-center pb-6">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full px-6 shadow-sm bg-background"
            onClick={() => { setLoadingMore(true); setLimit(prev => prev + 10); }} 
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            Muat 10 Transaksi Lagi
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <EditCashTransactionDialog
        open={!!editTransaction}
        onOpenChange={(open) => !open && setEditTransaction(null)}
        transaction={editTransaction}
        cashAccounts={cashAccounts}
        onSuccess={() => { fetchTransactions(limit, filterAccount, filterType, startDate, endDate); onRefresh(); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Data saldo pada akun kas Anda akan disesuaikan secara otomatis setelah penghapusan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">Hapus Permanen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}