'use client'

import React from "react"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { Product, Client, PurchaseInvoice, Order } from '@/lib/types'

interface AddSaleDialogProps {
  products: Product[]
  clients: Client[]
  invoices: PurchaseInvoice[]
  orders: Order[]
  onSuccess: () => void
}

interface SaleItemInput {
  productId: string
  quantity: number
  customPrice: number | null
  customCost: number | null
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function AddSaleDialog({ products, clients, invoices, orders, onSuccess }: AddSaleDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<SaleItemInput[]>([{ productId: '', quantity: 1, customPrice: null, customCost: null }])
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [clientId, setClientId] = useState<string>('none')
  const [invoiceId, setInvoiceId] = useState<string>('none')
  const [orderId, setOrderId] = useState<string>('none')
  const router = useRouter()

  const availableOrders = orders.filter(
    order => (order.status === 'pending' || order.status === 'in_progress') && 
             (clientId === 'none' || order.client_id === clientId)
  )

  const handleOrderSelect = (selectedOrderId: string) => {
    setOrderId(selectedOrderId)
    if (selectedOrderId === 'none') return
    const selectedOrder = orders.find(o => o.id === selectedOrderId)
    if (!selectedOrder || !selectedOrder.items) return
    if (selectedOrder.client_id) setClientId(selectedOrder.client_id)
    if (selectedOrder.notes) setNotes(selectedOrder.notes)
    
    const saleItems: SaleItemInput[] = selectedOrder.items.map(item => {
      const product = products.find(p => p.id === item.product_id)
      return {
        productId: item.product_id || '',
        quantity: item.quantity,
        customPrice: item.unit_price,
        customCost: product?.cost || null,
      }
    }).filter(item => item.productId)
    
    if (saleItems.length > 0) setItems(saleItems)
  }

  const availableInvoices = invoices.filter(
    inv => inv.status === 'pending' && (clientId === 'none' || inv.client_id === clientId)
  )

  const selectedInvoice = invoices.find(inv => inv.id === invoiceId)
  const additionalCost = selectedInvoice?.total_amount || 0

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, customPrice: null, customCost: null }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof SaleItemInput, value: string | number | null) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === 'productId') {
      newItems[index].customPrice = null
      newItems[index].customCost = null
    }
    setItems(newItems)
  }

  const getItemPrice = (item: SaleItemInput) => {
    const product = products.find((p) => p.id === item.productId)
    if (!product) return 0
    return item.customPrice !== null ? item.customPrice : product.price
  }

  const getItemCost = (item: SaleItemInput) => {
    const product = products.find((p) => p.id === item.productId)
    if (!product) return 0
    return item.customCost !== null ? item.customCost : product.cost
  }

  const calculateTotals = () => {
    let totalAmount = 0
    let totalCost = 0
    items.forEach((item) => {
      if (item.productId) {
        totalAmount += getItemPrice(item) * item.quantity
        totalCost += getItemCost(item) * item.quantity
      }
    })
    totalCost += additionalCost
    return { totalAmount, totalCost, additionalCost }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const validItems = items.filter((item) => item.productId && item.quantity > 0)
    if (validItems.length === 0) { setIsLoading(false); return }

    const { totalAmount, totalCost, additionalCost: addCost } = calculateTotals()

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: user.id,
        client_id: clientId === 'none' ? null : clientId,
        purchase_invoice_id: invoiceId === 'none' ? null : invoiceId,
        total_amount: totalAmount,
        total_cost: totalCost,
        additional_cost: addCost,
        notes: notes || null,
        sale_date: saleDate,
      })
      .select().single()

    if (saleError || !sale) { setIsLoading(false); return }

    const saleItems = validItems.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      const unitPrice = getItemPrice(item)
      return {
        sale_id: sale.id,
        product_id: item.productId,
        product_name: product?.name || 'Unknown Product',
        quantity: item.quantity,
        unit_price: unitPrice,
        unit_cost: getItemCost(item),
        total_price: unitPrice * item.quantity,
      }
    })

    await supabase.from('sale_items').insert(saleItems)
    if (invoiceId !== 'none') await supabase.from('purchase_invoices').update({ status: 'used' }).eq('id', invoiceId)
    if (orderId !== 'none') await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)

    setIsLoading(false)
    setOpen(false)
    setItems([{ productId: '', quantity: 1, customPrice: null, customCost: null }])
    setNotes('')
    setClientId('none')
    setInvoiceId('none')
    setOrderId('none')
    setSaleDate(new Date().toISOString().split('T')[0])
    onSuccess()
    router.refresh()
  }

  const { totalAmount, totalCost } = calculateTotals()
  const profit = totalAmount - totalCost

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Penjualan
        </Button>
      </DialogTrigger>
      
      {/* MODIFIKASI: Menambahkan h-[90vh] dan p-0 untuk mengontrol layout internal */}
      <DialogContent className="sm:max-w-[600px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Tambah Penjualan</DialogTitle>
          <DialogDescription>
            Catat transaksi penjualan baru
          </DialogDescription>
        </DialogHeader>

        {/* MODIFIKASI: Container form dibagi menjadi area scroll (flex-1) dan footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4 py-4">
              {availableOrders.length > 0 && (
                <div className="grid gap-2">
                  <Label>Ambil dari Order (opsional)</Label>
                  <Select value={orderId} onValueChange={handleOrderSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih order untuk diambil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Order</SelectItem>
                      {availableOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.order_number} - {order.client?.name || 'Tanpa Client'} ({formatCurrency(order.total_amount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sale-date">Tanggal</Label>
                  <Input id="sale-date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label>Client (opsional)</Label>
                  <Select value={clientId} onValueChange={(val) => { setClientId(val); setInvoiceId('none'); setOrderId('none'); }}>
                    <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Client</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {availableInvoices.length > 0 && (
                <div className="grid gap-2">
                  <Label>Invoice Belanja (opsional)</Label>
                  <Select value={invoiceId} onValueChange={setInvoiceId}>
                    <SelectTrigger><SelectValue placeholder="Pilih invoice belanja" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Invoice</SelectItem>
                      {availableInvoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {invoice.client?.name} ({formatCurrency(invoice.total_amount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-3">
                <Label>Item Penjualan</Label>
                {items.map((item, index) => {
                  const selectedProduct = products.find((p) => p.id === item.productId)
                  return (
                    <div key={index} className="rounded-lg border p-3 space-y-2 bg-card">
                      <div className="flex gap-2">
                        <Select value={item.productId} onValueChange={(value) => updateItem(index, 'productId', value)}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>{product.name} - {formatCurrency(product.price)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} min="1" className="w-20" />
                        {items.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                      {selectedProduct && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Harga Jual</Label>
                            <Input type="number" value={item.customPrice ?? selectedProduct.price} onChange={(e) => updateItem(index, 'customPrice', e.target.value ? parseFloat(e.target.value) : null)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Modal</Label>
                            <Input type="number" value={item.customCost ?? selectedProduct.cost} onChange={(e) => updateItem(index, 'customCost', e.target.value ? parseFloat(e.target.value) : null)} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" /> Tambah Item
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Catatan</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan..." rows={2} />
              </div>

              <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between text-sm"><span>Total Penjualan:</span><span className="font-medium">{formatCurrency(totalAmount)}</span></div>
                <div className="flex justify-between text-sm"><span>Total Modal:</span><span className="font-medium">{formatCurrency(totalCost)}</span></div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Profit Est:</span>
                  <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>{formatCurrency(profit)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* MODIFIKASI: Footer diletakkan di luar area scroll agar sticky di bawah */}
          <DialogFooter className="p-6 border-t bg-background">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={isLoading || items.every((i) => !i.productId)}>
              {isLoading ? 'Menyimpan...' : 'Simpan Penjualan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}