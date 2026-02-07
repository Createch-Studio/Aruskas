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
import { Eye, Pencil, Trash2, Loader2, AlertTriangle, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { EditInvoiceDialog } from '@/components/edit-invoice-dialog'
import type { PurchaseInvoice, Client } from '@/lib/types'
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
    case 'pending': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 uppercase text-[10px]">Pending</Badge>
    case 'used': return <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 uppercase text-[10px]">Selesai</Badge>
    case 'cancelled': return <Badge variant="destructive" className="uppercase text-[10px]">Dibatalkan</Badge>
    default: return <Badge className="uppercase text-[10px]">{status}</Badge>
  }
}

export function InvoiceTable({ invoices, clients, onRefresh }: InvoiceTableProps) {
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseInvoice | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  const handleDelete = async (invoice: PurchaseInvoice) => {
    setDeletingId(invoice.id)
    const isTypeIn = invoice.description?.toLowerCase().includes('pembelian')
    
    try {
      // 1. REVERT STOK SECARA DINAMIS
      if (invoice.status !== 'cancelled' && invoice.items) {
        for (const item of invoice.items) {
          if (item.inventory_id) {
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', item.inventory_id).single()
            if (inv) {
              // Jika dulu 'Masuk' (Beli), maka saat hapus stok harus DIKURANGI
              // Jika dulu 'Keluar' (Pakai), maka saat hapus stok harus DITAMBAH
              const revertedQty = isTypeIn ? inv.quantity - item.quantity : inv.quantity + item.quantity
              await supabase.from('inventory').update({ quantity: revertedQty }).eq('id', item.inventory_id)
            }
          }
        }
      }

      // 2. HAPUS DATA (Supabase akan handle cascade delete jika foreign key diatur CASCADE)
      // Jika tidak, urutan ini krusial:
      await supabase.from('expenses').delete().eq('purchase_invoice_id', invoice.id)
      await supabase.from('purchase_invoice_items').delete().eq('purchase_invoice_id', invoice.id)
      const { error: invError } = await supabase.from('purchase_invoices').delete().eq('id', invoice.id)

      if (invError) throw invError

      toast.success(`Invoice ${invoice.invoice_number} berhasil dihapus`)
      onRefresh()
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] uppercase font-bold tracking-wider">Tipe</TableHead>
              <TableHead className="text-[11px] uppercase font-bold tracking-wider">No. Invoice</TableHead>
              <TableHead className="text-[11px] uppercase font-bold tracking-wider">Tanggal</TableHead>
              <TableHead className="text-[11px] uppercase font-bold tracking-wider">Pihak Terkait</TableHead>
              <TableHead className="text-[11px] uppercase font-bold tracking-wider text-right">Total Nilai</TableHead>
              <TableHead className="text-[11px] uppercase font-bold tracking-wider text-center">Status</TableHead>
              <TableHead className="w-[120px] text-center text-[11px] uppercase font-bold tracking-wider">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const isTypeIn = invoice.description?.toLowerCase().includes('pembelian');
              return (
                <TableRow key={invoice.id} className="hover:bg-slate-50/50 transition-colors group">
                  <TableCell>
                    {isTypeIn ? 
                      <ArrowDownLeft className="h-4 w-4 text-emerald-500" /> : 
                      <ArrowUpRight className="h-4 w-4 text-orange-500" />
                    }
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-700">{invoice.invoice_number}</TableCell>
                  <TableCell className="text-sm text-slate-600">{formatDate(invoice.invoice_date)}</TableCell>
                  <TableCell className="text-sm font-medium">{invoice.client?.name || '-'}</TableCell>
                  <TableCell className={cn(
                    "text-right font-bold text-sm font-mono",
                    isTypeIn ? "text-emerald-700" : "text-slate-900"
                  )}>
                    {isTypeIn ? '+' : '-'}{formatCurrency(invoice.total_amount)}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingInvoice(invoice)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => setEditingInvoice(invoice)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10">
                            {deletingId === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-none shadow-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                              <AlertTriangle className="h-5 w-5" /> Hapus Transaksi?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-600">
                              Menghapus <strong>{invoice.invoice_number}</strong> akan mengembalikan stok sebesar total qty item di dalamnya. Data keuangan juga akan dihapus.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-none bg-slate-100">Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(invoice)} className="bg-destructive hover:bg-destructive/90">
                              Ya, Hapus & Revert
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog Improved */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl border-none shadow-2xl p-0 overflow-hidden">
          {viewingInvoice && (
            <>
              <div className={cn(
                "p-6 text-white flex justify-between items-start",
                viewingInvoice.description?.toLowerCase().includes('pembelian') ? "bg-emerald-600" : "bg-slate-900"
              )}>
                <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Detail Transaksi</p>
                    <h2 className="text-2xl font-black font-mono">{viewingInvoice.invoice_number}</h2>
                    <p className="text-sm opacity-90">{formatDate(viewingInvoice.invoice_date)}</p>
                </div>
                <div className="text-right">
                    <Badge className="bg-white/20 hover:bg-white/30 border-none text-white mb-2">
                        {viewingInvoice.description?.toLowerCase().includes('pembelian') ? 'Masuk/Pembelian' : 'Keluar/Pemakaian'}
                    </Badge>
                    <p className="font-bold text-lg leading-tight">{viewingInvoice.client?.name || '-'}</p>
                </div>
              </div>

              <div className="p-6 space-y-6 bg-white">
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase font-bold">Item Deskripsi</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-bold">Qty</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-bold">Harga</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-bold">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingInvoice.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="py-3">
                              <p className="text-sm font-semibold text-slate-800">{item.description}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{item.inventory_id ? 'ID Gudang' : 'Custom Item'}</p>
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                          <TableCell className="text-right text-xs text-slate-500 font-mono">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right text-sm font-bold font-mono text-slate-700">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center px-2">
                    <div className="text-xs text-muted-foreground">
                        Status: {getStatusBadge(viewingInvoice.status)}
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Grand Total</p>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(viewingInvoice.total_amount)}</p>
                    </div>
                </div>
              </div>
            </>
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