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
  pending: 'bg-yellow-500',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <div className="rounded-md border">
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
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Belum ada order
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>{order.client?.name || '-'}</TableCell>
                  <TableCell>{order.items?.length || 0} item</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewingOrder(order)}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Lihat</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingOrder(order)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Hapus</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Order</AlertDialogTitle>
                            <AlertDialogDescription>
                              Yakin ingin menghapus order ini? Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(order.id)}>
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

      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Order</DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nomor Order:</span>
                  <div className="font-medium">{viewingOrder.order_number}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div>
                    <Badge className={statusColors[viewingOrder.status]}>
                      {statusLabels[viewingOrder.status]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tanggal Order:</span>
                  <div className="font-medium">{formatDate(viewingOrder.order_date)}</div>
                </div>
                {viewingOrder.delivery_date && (
                  <div>
                    <span className="text-muted-foreground">Tanggal Kirim:</span>
                    <div className="font-medium">{formatDate(viewingOrder.delivery_date)}</div>
                  </div>
                )}
                {viewingOrder.client && (
                  <div>
                    <span className="text-muted-foreground">Client:</span>
                    <div className="font-medium">{viewingOrder.client.name}</div>
                  </div>
                )}
                {viewingOrder.description && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Deskripsi:</span>
                    <div className="font-medium">{viewingOrder.description}</div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Item Order:</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingOrder.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between border-t pt-4 text-lg font-semibold">
                <span>Total:</span>
                <span>{formatCurrency(viewingOrder.total_amount)}</span>
              </div>

              {viewingOrder.notes && (
                <div className="rounded-lg bg-muted p-3">
                  <span className="text-sm text-muted-foreground">Catatan:</span>
                  <p className="text-sm">{viewingOrder.notes}</p>
                </div>
              )}
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
