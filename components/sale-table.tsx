'use client'

import React, { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { EditSaleDialog } from "@/components/edit-sale-dialog"
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

export function SaleTable({ sales, products, clients, invoices, onRefresh }: SaleTableProps) {
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()
    
    // 1. Cari data penjualan untuk mendapatkan ID Invoice atau Order terkait
    const sale = sales.find(s => s.id === id)
    
    try {
      // 2. Reset status Invoice Belanja jika ada
      if (sale?.purchase_invoice_id) {
        await supabase
          .from('purchase_invoices')
          .update({ status: 'pending' })
          .eq('id', sale.purchase_invoice_id)
      }

      // 3. Reset status Order jika ada (Optional: sesuaikan nama field order_id di table sales Anda)
      // @ts-ignore - Menangani jika order_id ada secara dinamis
      if (sale?.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'proses' })
          .eq('id', sale.order_id)
      }
      
      // 4. Hapus item penjualan
      await supabase.from('sale_items').delete().eq('sale_id', id)
      
      // 5. Hapus data penjualan utama
      await supabase.from('sales').delete().eq('id', id)
      
      onRefresh()
      router.refresh()
    } catch (error) {
      console.error("Error deleting sale:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (sales.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground border rounded-lg border-dashed">
        Belum ada data penjualan
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
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
                  <TableCell className="whitespace-nowrap">{formatDate(sale.sale_date)}</TableCell>
                  <TableCell>{sale.client?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{itemCount} item</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(sale.total_amount)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {formatCurrency(sale.total_cost)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={profit >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                      {formatCurrency(profit)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">
                    {sale.notes || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewingSale(sale)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingSale(sale)}>
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
                            <AlertDialogTitle>Hapus Penjualan?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tindakan ini akan menghapus data penjualan dan mereset status Invoice/Order terkait menjadi sedia kembali.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(sale.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Menghapus..." : "Hapus"}
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

      {/* Dialog Detail dengan Scroll */}
      <Dialog open={!!viewingSale} onOpenChange={(open) => !open && setViewingSale(null)}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle>Detail Penjualan</DialogTitle>
          </DialogHeader>
          
          {viewingSale && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Tanggal Transaksi</span>
                  <p className="font-semibold">{formatDate(viewingSale.sale_date)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Client</span>
                  <p className="font-semibold">{viewingSale.client?.name || 'Tanpa Client'}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-semibold">Item Terjual</span>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
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
                          <TableCell className="font-medium">{item.product?.name || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {viewingSale.notes && (
                <div className="bg-muted/30 p-4 rounded-lg border border-dashed">
                  <Label className="text-xs text-muted-foreground uppercase">Catatan:</Label>
                  <p className="text-sm mt-1">{viewingSale.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Sticky Footer Ringkasan Biaya */}
          {viewingSale && (
            <div className="p-6 border-t bg-background">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Penjualan:</span>
                  <span className="font-semibold">{formatCurrency(viewingSale.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Modal:</span>
                  <span className="font-semibold text-destructive">{formatCurrency(viewingSale.total_cost)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-bold text-lg">Estimasi Profit:</span>
                  <span className={`text-xl font-bold ${viewingSale.total_amount - viewingSale.total_cost >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(viewingSale.total_amount - viewingSale.total_cost)}
                  </span>
                </div>
              </div>
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