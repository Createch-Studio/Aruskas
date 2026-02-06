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
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { EditInvoiceDialog } from '@/components/edit-invoice-dialog'
import type { PurchaseInvoice, Client } from '@/lib/types'

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
  const [isDeleting, setIsDeleting] = useState(false) // State loading untuk hapus
  const router = useRouter()

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()
    
    try {
      // 1. Hapus pengeluaran terkait di tabel expenses
      // Menggunakan purchase_invoice_id sebagai kunci pencocokan
      await supabase
        .from('expenses')
        .delete()
        .eq('purchase_invoice_id', id)

      // 2. Hapus item invoice
      await supabase
        .from('purchase_invoice_items')
        .delete()
        .eq('purchase_invoice_id', id)

      // 3. Hapus data invoice utama
      await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', id)

      onRefresh()
      router.refresh()
    } catch (error) {
      console.error("Gagal menghapus invoice dan pengeluaran:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
        Belum ada invoice. Klik tombol &quot;Tambah Invoice&quot; untuk membuat invoice baru.
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
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Invoice & Pengeluaran?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Menghapus invoice ini juga akan menghapus catatan pengeluaran terkait di laporan keuangan. Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(invoice.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Menghapus..." : "Hapus"}
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

      {/* Detail Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Detail Invoice Belanja</DialogTitle>
          </DialogHeader>
          
          {viewingInvoice && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">No. Invoice</span>
                  <p className="font-semibold">{viewingInvoice.invoice_number}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tanggal</span>
                  <p className="font-semibold">{formatDate(viewingInvoice.invoice_date)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Client</span>
                  <p className="font-semibold text-primary">{viewingInvoice.client?.name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</span>
                  <div>{getStatusBadge(viewingInvoice.status)}</div>
                </div>
              </div>
              
              {viewingInvoice.description && (
                <div className="text-sm bg-blue-50/50 border border-blue-100 p-3 rounded-md">
                  <span className="text-[10px] text-blue-700 uppercase font-bold tracking-wider block mb-1">Keterangan</span>
                  <p className="text-slate-700">{viewingInvoice.description}</p>
                </div>
              )}

              <div className="space-y-3">
                <span className="text-sm font-bold flex items-center gap-2">
                  Daftar Item Belanja
                  <Badge variant="outline" className="font-normal">{viewingInvoice.items?.length || 0} Item</Badge>
                </span>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Deskripsi Item</TableHead>
                        <TableHead className="text-right w-[80px] text-xs">Qty</TableHead>
                        <TableHead className="text-right text-xs">Harga Satuan</TableHead>
                        <TableHead className="text-right text-xs">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingInvoice.items?.map((item) => (
                        <TableRow key={item.id} className="text-sm">
                          <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Sticky Footer Total */}
          {viewingInvoice && (
            <div className="p-6 border-t bg-slate-50 shrink-0">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-tighter">Total Dibayar</span>
                  <p className="text-[10px] text-muted-foreground">Termasuk seluruh item di atas</p>
                </div>
                <span className="text-2xl font-black text-slate-900">{formatCurrency(viewingInvoice.total_amount)}</span>
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