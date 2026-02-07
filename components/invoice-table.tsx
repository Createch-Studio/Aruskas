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
import { Eye, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { EditInvoiceDialog } from '@/components/edit-invoice-dialog'
import type { PurchaseInvoice, Client } from '@/lib/types'
import { toast } from "sonner"

interface InvoiceTableProps {
  invoices: PurchaseInvoice[]
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
    month: 'short',
    year: 'numeric',
  })
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending': return <Badge variant="secondary">Pending</Badge>
    case 'used': return <Badge variant="default">Digunakan</Badge>
    case 'cancelled': return <Badge variant="destructive">Dibatalkan</Badge>
    default: return <Badge>{status}</Badge>
  }
}

export function InvoiceTable({ invoices, clients, onRefresh }: InvoiceTableProps) {
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseInvoice | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  const handleDelete = async (invoice: PurchaseInvoice) => {
    setDeletingId(invoice.id)
    
    try {
      // 1. REVERT STOK (Kembalikan barang ke Gudang)
      // Hanya lakukan jika statusnya bukan 'cancelled' (karena cancelled stok sudah kembali)
      if (invoice.status !== 'cancelled' && invoice.items) {
        for (const item of invoice.items) {
          if (item.inventory_id) {
            // Ambil stok saat ini
            const { data: inv } = await supabase
              .from('inventory')
              .select('quantity')
              .eq('id', item.inventory_id)
              .single()

            if (inv) {
              await supabase
                .from('inventory')
                .update({ quantity: inv.quantity + item.quantity }) // Tambah balik stoknya
                .eq('id', item.inventory_id)
            }
          }
        }
      }

      // 2. HAPUS EXPENSES TERKAIT
      await supabase
        .from('expenses')
        .delete()
        .ilike('description', `%Belanja ${invoice.invoice_number}%`)

      // 3. HAPUS DETAIL ITEM
      await supabase
        .from('purchase_invoice_items')
        .delete()
        .eq('purchase_invoice_id', invoice.id)

      // 4. HAPUS INVOICE UTAMA
      const { error: invError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoice.id)

      if (invError) throw invError

      toast.success(`Invoice ${invoice.invoice_number} dihapus & stok dikembalikan`)
      onRefresh()
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed bg-slate-50/50">
        Belum ada data invoice pemakaian.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs uppercase font-bold">No. Invoice</TableHead>
              <TableHead className="text-xs uppercase font-bold">Tanggal</TableHead>
              <TableHead className="text-xs uppercase font-bold">Pemakai</TableHead>
              <TableHead className="text-xs uppercase font-bold text-right">Total Nilai</TableHead>
              <TableHead className="text-xs uppercase font-bold">Status</TableHead>
              <TableHead className="w-[120px] text-center text-xs uppercase font-bold">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell className="font-mono text-sm font-semibold">{invoice.invoice_number}</TableCell>
                <TableCell className="text-sm">{formatDate(invoice.invoice_date)}</TableCell>
                <TableCell className="text-sm font-medium">{invoice.client?.name || '-'}</TableCell>
                <TableCell className="text-right font-bold text-sm">{formatCurrency(invoice.total_amount)}</TableCell>
                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingInvoice(invoice)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setEditingInvoice(invoice)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          disabled={deletingId === invoice.id}
                        >
                          {deletingId === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" /> Konfirmasi Hapus
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Menghapus invoice <strong>{invoice.invoice_number}</strong> akan otomatis mengembalikan semua item ke stok gudang. Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(invoice)}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                          >
                            Hapus & Revert Stok
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rincian Pemakaian Barang</DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-8 text-sm border-b pb-6">
                <div className="space-y-1">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">Informasi Invoice</p>
                  <p className="font-mono text-lg font-bold">{viewingInvoice.invoice_number}</p>
                  <p>{formatDate(viewingInvoice.invoice_date)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">Unit / Client</p>
                  <p className="font-bold text-lg">{viewingInvoice.client?.name || '-'}</p>
                  <div>{getStatusBadge(viewingInvoice.status)}</div>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingInvoice.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                            <p className="font-medium">{item.description}</p>
                            {!item.inventory_id && <Badge variant="outline" className="text-[9px] h-4">Custom Item</Badge>}
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center shadow-inner">
                <span className="text-sm font-medium">Total Nilai Keluar</span>
                <span className="text-2xl font-black">{formatCurrency(viewingInvoice.total_amount)}</span>
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