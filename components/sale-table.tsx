'use client'

import { Label } from "@/components/ui/label"
import { EditSaleDialog } from "@/components/edit-sale-dialog" // Import EditSaleDialog

import React from "react"

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
import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Sale, Product, Client, PurchaseInvoice } from '@/lib/types'

interface SaleTableProps {
  sales: Sale[]
  products: Product[]
  clients: Client[]
  invoices: PurchaseInvoice[]
  onRefresh: () => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function SaleTable({ sales, products, clients, invoices, onRefresh }: SaleTableProps) {
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    
    // Find the sale to check if it has an invoice
    const sale = sales.find(s => s.id === id)
    
    // If sale has an invoice, reset it to pending
    if (sale?.purchase_invoice_id) {
      await supabase
        .from('purchase_invoices')
        .update({ status: 'pending' })
        .eq('id', sale.purchase_invoice_id)
    }
    
    // Delete sale items first
    await supabase.from('sale_items').delete().eq('sale_id', id)
    // Then delete sale
    await supabase.from('sales').delete().eq('id', id)
    onRefresh()
    router.refresh()
  }

  if (sales.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        Belum ada data penjualan
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Modal</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead>Catatan</TableHead>
            <TableHead className="w-[120px]">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => {
            const profit = sale.total_amount - sale.total_cost
            const itemCount = sale.items?.length || 0
            return (
              <TableRow key={sale.id}>
                <TableCell>{formatDate(sale.sale_date)}</TableCell>
                <TableCell>{sale.client?.name || '-'}</TableCell>
                <TableCell>{itemCount} item</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(sale.total_amount)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(sale.total_cost)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>
                    {formatCurrency(profit)}
                  </span>
                </TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {sale.notes || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewingSale(sale)}
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Lihat</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingSale(sale)}
                    >
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
                          <AlertDialogTitle>Hapus Penjualan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Penjualan akan
                            dihapus secara permanen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(sale.id)}
                          >
                            Hapus
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

      <Dialog open={!!viewingSale} onOpenChange={(open) => !open && setViewingSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Penjualan</DialogTitle>
          </DialogHeader>
          {viewingSale && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formatDate(viewingSale.sale_date)}</span>
                {viewingSale.client && <span>Client: {viewingSale.client.name}</span>}
              </div>
              
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingSale.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name || '-'}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Penjualan:</span>
                  <span className="font-medium">{formatCurrency(viewingSale.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Modal:</span>
                  <span className="font-medium">{formatCurrency(viewingSale.total_cost)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Profit:</span>
                  <span className={viewingSale.total_amount - viewingSale.total_cost >= 0 ? 'text-green-600' : 'text-destructive'}>
                    {formatCurrency(viewingSale.total_amount - viewingSale.total_cost)}
                  </span>
                </div>
              </div>

              {viewingSale.notes && (
                <div>
                  <Label className="text-sm font-medium">Catatan:</Label>
                  <p className="text-sm text-muted-foreground">{viewingSale.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditSaleDialog
        sale={editingSale}
        products={products}
        clients={clients}
        invoices={invoices}
        open={!!editingSale}
        onOpenChange={(open) => !open && setEditingSale(null)}
        onSuccess={onRefresh}
      />
    </>
  )
}
