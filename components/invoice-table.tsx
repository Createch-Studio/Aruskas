'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Eye, Pencil, Trash2, Loader2 } from 'lucide-react'
import { EditInvoiceDialog } from '@/components/edit-invoice-dialog'
import type { PurchaseInvoice, Client } from '@/lib/types'
import { toast } from "sonner" // Asumsi menggunakan sonner, atau ganti dengan alert biasa

interface InvoiceTableProps {
  invoices: PurchaseInvoice[]
  clients: Client[]
  onRefresh: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
    case 'used':
      return <Badge variant="default">Digunakan</Badge>
    case 'cancelled':
      return <Badge variant="destructive">Dibatalkan</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export function InvoiceTable({ invoices, clients, onRefresh }: InvoiceTableProps) {
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseInvoice | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async (invoice: PurchaseInvoice) => {
    setDeletingId(invoice.id)
    const supabase = createClient()
    
    try {
      // 1. HAPUS EXPENSES (Logika Ganda)
      // Pertama cari berdasarkan ID (Cara yang benar)
      // Kedua cari berdasarkan deskripsi (Emergency/Data Lama)
      const { error: expError } = await supabase
        .from('expenses')
        .delete()
        .or(`purchase_invoice_id.eq.${invoice.id},description.ilike.%Otomatis: Belanja%${invoice.invoice_number}%`)

      if (expError) console.error("Expense delete error:", expError)

      // 2. HAPUS ITEMS
      await supabase
        .from('purchase_invoice_items')
        .delete()
        .eq('purchase_invoice_id', invoice.id)

      // 3. HAPUS INVOICE UTAMA
      const { error: invError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoice.id)

      if (invError) throw invError

      toast.success("Invoice dan pengeluaran berhasil dihapus")
      onRefresh()
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
        Belum ada invoice.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>No. Invoice</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                <TableCell>{invoice.client?.name || '-'}</TableCell>
                <TableCell className="max-w-[200px] truncate">{invoice.description || '-'}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(invoice.total_amount)}</TableCell>
                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewingInvoice(invoice)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {invoice.status === 'pending' && (
                      <Button variant="ghost" size="icon" onClick={() => setEditingInvoice(invoice)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {invoice.status === 'pending' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive"
                            disabled={deletingId === invoice.id}
                          >
                            {deletingId === invoice.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Invoice & Pengeluaran?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Semua data terkait invoice <strong>{invoice.invoice_number}</strong> akan dihapus permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(invoice)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Hapus Sekarang
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- Detail Dialog & Edit Dialog Tetap Sama --- */}
      {/* ... (bagian Dialog Detail Anda di sini) ... */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Detail Invoice Belanja</DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">No. Invoice</span>
                        <p className="font-semibold">{viewingInvoice.invoice_number}</p>
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Tanggal</span>
                        <p className="font-semibold">{formatDate(viewingInvoice.invoice_date)}</p>
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Client</span>
                        <p className="font-semibold">{viewingInvoice.client?.name || '-'}</p>
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Status</span>
                        <div>{getStatusBadge(viewingInvoice.status)}</div>
                    </div>
                </div>
                {/* Tabel Item */}
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="text-xs">Deskripsi</TableHead>
                                <TableHead className="text-right text-xs">Qty</TableHead>
                                <TableHead className="text-right text-xs">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {viewingInvoice.items?.map((item) => (
                                <TableRow key={item.id} className="text-sm">
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-50 border rounded-lg">
                    <span className="font-bold">Total Pembayaran</span>
                    <span className="text-xl font-black">{formatCurrency(viewingInvoice.total_amount)}</span>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditInvoiceDialog
        invoice={editingInvoice}
        clients={clients}
        open={!!editingInvoice}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
        onSuccess={onRefresh}
      />
    </>
  )
}