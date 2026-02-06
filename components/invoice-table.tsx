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
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('purchase_invoice_items').delete().eq('purchase_invoice_id', id)
    await supabase.from('purchase_invoices').delete().eq('id', id)
    onRefresh()
    router.refresh()
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Belum ada invoice. Klik tombol &quot;Tambah Invoice&quot; untuk membuat invoice baru.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
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
                <TableCell>{invoice.description || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.total_amount)}</TableCell>
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
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Invoice?</AlertDialogTitle>
                            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(invoice.id)}>Hapus</AlertDialogAction>
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

      {/* Detail Dialog dengan Scroll */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle>Detail Invoice</DialogTitle>
          </DialogHeader>
          
          {viewingInvoice && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Info Header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">No. Invoice</span>
                  <p className="font-semibold">{viewingInvoice.invoice_number}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Tanggal</span>
                  <p className="font-semibold">{formatDate(viewingInvoice.invoice_date)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Client</span>
                  <p className="font-semibold">{viewingInvoice.client?.name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Status</span>
                  <div>{getStatusBadge(viewingInvoice.status)}</div>
                </div>
              </div>
              
              {viewingInvoice.description && (
                <div className="text-sm bg-muted/50 p-3 rounded-md">
                  <span className="text-xs text-muted-foreground uppercase block mb-1">Deskripsi</span>
                  <p>{viewingInvoice.description}</p>
                </div>
              )}

              {/* Items Table Section */}
              <div className="space-y-2">
                <span className="text-sm font-semibold">Daftar Item Belanja</span>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Deskripsi Item</TableHead>
                        <TableHead className="text-right w-[80px]">Qty</TableHead>
                        <TableHead className="text-right">Harga Satuan</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingInvoice.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                          <TableCell className="text-right font-medium">{item.quantity}</TableCell>
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
            <div className="p-6 border-t bg-muted/20">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Total Keseluruhan</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(viewingInvoice.total_amount)}</span>
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