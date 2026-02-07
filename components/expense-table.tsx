'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Info, Lock } from 'lucide-react'
import { EditExpenseDialog } from '@/components/edit-expense-dialog'
import type { Expense, ExpenseCategory, Client } from '@/lib/types'
import { toast } from "sonner"

interface ExpenseTableProps {
  expenses: Expense[]
  categories: ExpenseCategory[]
  clients: Client[]
  onRefresh: () => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function ExpenseTable({ expenses, categories, clients, onRefresh }: ExpenseTableProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      
      toast.success("Pengeluaran berhasil dihapus")
      onRefresh()
      router.refresh()
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-slate-50/50">
        Belum ada data pengeluaran tercatat
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold tracking-wider">Tanggal</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-wider">Kategori</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-wider">Client / Unit</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-wider">Deskripsi</TableHead>
              <TableHead className="text-[10px] uppercase font-bold tracking-wider text-right">Jumlah</TableHead>
              <TableHead className="w-[100px] text-center text-[10px] uppercase font-bold tracking-wider">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => {
              /**
               * LOGIKA DETEKSI AUTOMATIS:
               * 1. Cek apakah ada field 'purchase_invoice_id' (Cara paling akurat)
               * 2. Cek apakah deskripsi mengandung kata "Otomatis: Belanja" (Cara fallback)
               */
              const isAutomatic = !!expense.purchase_invoice_id || expense.description?.includes("Otomatis: Belanja")

              return (
                <TableRow key={expense.id} className={isAutomatic ? "bg-blue-50/30" : ""}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={isAutomatic ? "default" : "outline"} 
                      className={isAutomatic ? "bg-blue-600 hover:bg-blue-600" : "text-slate-600"}
                    >
                      {expense.category?.name || 'Umum'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {expense.client?.name || '-'}
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
                    {expense.description}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm text-slate-900">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      {isAutomatic ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 cursor-help">
                              <Lock className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="bg-slate-900 text-white border-none p-3 shadow-xl">
                            <p className="text-xs font-bold mb-1 flex items-center gap-2">
                                <Info className="h-3 w-3" /> Data Terkunci
                            </p>
                            <p className="text-[10px] opacity-80">
                                Ini adalah pengeluaran otomatis dari stok. <br />
                                Edit melalui menu <strong>Invoice Belanja</strong>.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500"
                            onClick={() => setEditingExpense(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Pengeluaran?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Data ini akan dihapus permanen dari laporan keuangan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(expense.id)}
                                  className="bg-destructive hover:bg-destructive/90 text-white"
                                  disabled={deletingId === expense.id}
                                >
                                  {deletingId === expense.id ? "Menghapus..." : "Hapus"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <EditExpenseDialog
        expense={editingExpense}
        categories={categories}
        clients={clients}
        open={!!editingExpense}
        onOpenChange={(open) => !open && setEditingExpense(null)}
        onSuccess={onRefresh}
      />
    </TooltipProvider>
  )
}