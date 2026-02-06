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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Order, Client, Product } from '@/lib/types'
import { EditOrderDialog } from '@/components/edit-order-dialog'

interface OrderTableProps {
  orders: Order[]
  clients: Client[]
  products: Product[]
  onRefresh: () => void
}

const statusColors = {
  pending: 'bg-yellow-500 hover:bg-yellow-600',
  processing: 'bg-blue-500 hover:bg-blue-600',
  completed: 'bg-green-500 hover:bg-green-600',
  cancelled: 'bg-red-500 hover:bg-red-600',
}

const statusLabels = {
  pending: 'Pending',
  processing: 'Proses',
  completed: 'Selesai',
  cancelled: 'Batal',
}

export function OrderTable({ orders, clients, products, onRefresh }: OrderTableProps) {
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('order_items').delete().eq('order_id', id)
    await supabase.from('orders').delete().eq('id', id)
    onRefresh()
    router.refresh()
  }

  // Format mata uang tanpa desimal ,00
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
    }).format(amount)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Order</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Belum ada data order
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>{order.client?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                        {order.items?.length || 0} item
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[order.status]} text-white border-none`}>
                      {statusLabels[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewingOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingOrder(order)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tindakan ini akan menghapus data order dan item di dalamnya secara permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => handleDelete(order.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Order Dialog dengan Scroll */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle>Detail Order</DialogTitle>
          </DialogHeader>
          
          {viewingOrder && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Nomor Order</span>
                  <div className="font-bold text-base">{viewingOrder.order_number}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Status</span>
                  <div>
                    <Badge className={`${statusColors[viewingOrder.status]} text-white border-none`}>
                      {statusLabels[viewingOrder.status]}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Tanggal Order</span>
                  <div className="font-semibold">{formatDate(viewingOrder.order_date)}</div>
                </div>
                {viewingOrder.delivery_date && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Tanggal Kirim</span>
                    <div className="font-semibold">{formatDate(viewingOrder.delivery_date)}</div>
                  </div>
                )}
                <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Client</span>
                    <div className="font-semibold">{viewingOrder.client?.name || 'Tanpa Client'}</div>
                </div>
              </div>

              {viewingOrder.description && (
                <div className="rounded-md bg-muted/50 p-3 border">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Deskripsi</span>
                  <p className="text-sm font-medium">{viewingOrder.description}</p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-sm uppercase tracking-wider">Daftar Item:</h4>
                <div className="rounded-md border overflow-hidden">
                    <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center w-[80px]">Qty</TableHead>
                        <TableHead className="text-right">Harga</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {viewingOrder.items?.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-right font-bold">
                            {formatCurrency(item.quantity * item.unit_price)}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
              </div>

              {viewingOrder.notes && (
                <div className="rounded-lg border border-dashed p-4">
                  <span className="text-xs text-muted-foreground uppercase font-bold">Catatan Produksi:</span>
                  <p className="text-sm mt-1 text-muted-foreground italic">"{viewingOrder.notes}"</p>
                </div>
              )}
            </div>
          )}

          {/* Sticky Total Footer */}
          {viewingOrder && (
            <div className="p-6 border-t bg-muted/20">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Total Tagihan</span>
                <span className="text-2xl font-black text-primary">{formatCurrency(viewingOrder.total_amount)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditOrderDialog
        order={editingOrder}
        clients={clients}
        products={products}
        open={!!editingOrder}
        onOpenChange={(open) => !open && setEditingOrder(null)}
        onSuccess={onRefresh}
      />
    </>
  )
}