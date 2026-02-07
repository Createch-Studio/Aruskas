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
import { Pencil, Trash2, Info } from 'lucide-react'
import { EditExpenseDialog } from '@/components/edit-expense-dialog'
import type { Expense, ExpenseCategory, Client } from '@/lib/types'

interface ExpenseTableProps {
  expenses: Expense[]
  categories: ExpenseCategory[]
  clients: Client[]
  onRefresh: () => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function ExpenseTable({ expenses, categories, clients, onRefresh }: ExpenseTableProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', id)
    onRefresh()
    router.refresh()
    setIsDeleting(false)
  }

  if (expenses.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground border rounded-lg border-dashed">
        Belum ada data pengeluaran
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="w-[100px] text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => {
              // Cek apakah kategori adalah Invoice Belanja
              const isInvoiceCategory = expense.category?.name === 'Invoice Belanja'

              return (
                <TableRow key={expense.id} className={isInvoiceCategory ? "bg-slate-50/50" : ""}>
                  <TableCell className="whitespace-nowrap">{formatDate(expense.date)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isInvoiceCategory ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                    }`}>
                      {expense.category?.name || '-'}
                    </span>
                  </TableCell>
                  <TableCell>{expense.client?.name || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      {isInvoiceCategory ? (
                        // Jika kategori Invoice Belanja, tampilkan tooltip informasi
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex gap-1 opacity-40 cursor-not-allowed">
                              <Button variant="ghost" size="icon" disabled>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" disabled>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[200px] text-center">
                            Pengeluaran ini otomatis. Ubah atau hapus melalui menu <strong>Invoice Belanja</strong>.
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        // Jika kategori biasa, tampilkan tombol normal
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingExpense(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Hapus</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Pengeluaran?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tindakan ini tidak dapat dibatalkan. Pengeluaran ini akan dihapus permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(expense.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? "Menghapus..." : "Hapus"}
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