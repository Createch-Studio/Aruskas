'use client'

import { useState } from 'react'
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
import { Eye, Pencil, Trash2, Loader2, AlertTriangle, ReceiptText } from 'lucide-react'
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
    case 'pending': return <Badge variant="secondary" className="capitalize">Pending</Badge>
    case 'used': return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 capitalize">Digunakan</Badge>
    case 'cancelled': return <Badge variant="destructive" className="capitalize">Dibatalkan</Badge>
    default: return <Badge className="capitalize">{status}</Badge>
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
      // Stok hanya dikembalikan jika statusnya bukan 'cancelled' 
      // (karena status cancelled seharusnya stok sudah kembali)
      if (invoice.status !== 'cancelled' && invoice.items) {
        for (const item of invoice.items) {
          if (item.inventory_id) {
            const { data: inv } = await supabase
              .from('inventory')
              .select('quantity')
              .eq('id', item.inventory_id)
              .single()

            if (inv) {
              await supabase
                .from('inventory')
                .update({ quantity: inv.quantity + item.quantity })
                .eq('id', item.inventory_id)
            }
          }
        }
      }

      // 2. HAPUS EXPENSES TERKAIT
      // Mencari berdasarkan purchase_invoice_id atau pola deskripsi otomatis
      await supabase
        .from('expenses')
        .delete()
        .or(`purchase_invoice_id.eq.${invoice.id},description.ilike.%Belanja ${invoice.invoice_number}%`)

      // 3. HAPUS DETAIL ITEM & INVOICE UTAMA (Cascading di DB biasanya menangani ini, tapi kita lakukan manual untuk keamanan)
      await supabase.from('purchase_invoice_items').delete().eq('purchase_invoice_id', invoice.id)
      
      const { error: invError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoice.id)

      if (invError) throw invError

      toast.success(`Invoice ${invoice.invoice_number} berhasil dihapus & stok disinkronkan`)
      onRefresh()
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl bg-slate-50/50">
        <ReceiptText className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-sm">Belum ada data invoice pemakaian.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">No. Invoice</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">Tanggal</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">Unit Pemakai</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider text-right">Total Nilai</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider text-center">Status</TableHead>
                <TableHead className="w-[120px] text-center text-[10px] uppercase font-bold tracking-wider">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-mono text-xs font-semibold">{invoice.invoice_number}</TableCell>
                  <TableCell className="text-xs">{formatDate(invoice.invoice_date)}</TableCell>
                  <TableCell className="text-xs font-medium">{invoice.client?.name || '-'}</TableCell>
                  <TableCell className="text-right font-bold text-xs">{formatCurrency(invoice.total_amount)}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingInvoice(invoice)}>
                        <Eye className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => setEditingInvoice(invoice)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            disabled={deletingId === invoice.id}
                          >
                            {deletingId === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" /> Hapus Data?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Menghapus <strong>{invoice.invoice_number}</strong> akan mengembalikan item ke stok gudang dan menghapus catatan pengeluaran.
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
      </div>

      {/* --- View Detail Dialog --- */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" /> Detail Pemakaian Barang
            </DialogTitle>
          </DialogHeader>
          
          {viewingInvoice && (
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground font-bold uppercase tracking-tighter text-[9px]">Nomor Invoice</p>
                    <p className="font-mono text-sm font-bold">{viewingInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-bold uppercase tracking-tighter text-[9px]">Unit Pemakai</p>
                    <p className="text-sm font-semibold">{viewingInvoice.client?.name || '-'}</p>
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <div>
                    <p className="text-muted-foreground font-bold uppercase tracking-tighter text-[9px]">Tanggal Transaksi</p>
                    <p className="text-sm font-semibold">{formatDate(viewingInvoice.invoice_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-bold uppercase tracking-tighter text-[9px]">Status Alokasi</p>
                    <div>{getStatusBadge(viewingInvoice.status)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="h-8">
                      <TableHead className="text-[10px] font-bold">Deskripsi Barang</TableHead>
                      <TableHead className="text-right text-[10px] font-bold">Qty</TableHead>
                      <TableHead className="text-right text-[10px] font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingInvoice.items?.map((item) => (
                      <TableRow key={item.id} className="h-10">
                        <TableCell className="text-xs">
                            <span className="font-medium">{item.description}</span>
                            {!item.inventory_id && <Badge variant="outline" className="ml-2 text-[8px] h-3 px-1 border-orange-200 text-orange-600 bg-orange-50 uppercase font-bold">Custom</Badge>}
                        </TableCell>
                        <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center">
                <span className="text-xs font-medium text-slate-400">Total Nilai Keluar</span>
                <span className="text-xl font-black tracking-tight">{formatCurrency(viewingInvoice.total_amount)}</span>
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