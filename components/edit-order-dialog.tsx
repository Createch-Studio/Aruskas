'use client'

import React from "react"

import { useState, useEffect } from 'react'
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
import type { Order, Client, Product, OrderItem } from '@/lib/types'

interface EditOrderDialogProps {
  order: Order | null
  clients: Client[]
  products: Product[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface OrderItemInput {
  id?: string
  productId: string
  description: string
  quantity: number
  unitPrice: number
}

export function EditOrderDialog({ order, clients, products, open, onOpenChange, onSuccess }: EditOrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [clientId, setClientId] = useState<string>('none')
  const [orderNumber, setOrderNumber] = useState('')
  const [description, setDescription] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed' | 'cancelled'>('pending')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItemInput[]>([])
  const router = useRouter()
  const [dueDate, setDueDate] = useState('') // Declare setDueDate variable

  useEffect(() => {
    if (order) {
      setClientId(order.client_id || 'none')
      setOrderNumber(order.order_number)
      setOrderDate(order.order_date?.split('T')[0] || '')
      setDueDate(order.due_date?.split('T')[0] || '')
      setStatus(order.status)
      setNotes(order.notes || '')
      
      if (order.items && order.items.length > 0) {
        setItems(order.items.map((item) => ({
          id: item.id,
          productId: item.product_id || 'none',
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })))
      } else {
        setItems([{ productId: 'none', description: '', quantity: 1, unitPrice: 0 }])
      }
    }
  }, [order])

  const addItem = () => {
    setItems([...items, { productId: 'none', description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof OrderItemInput, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'productId' && value !== 'none') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].description = product.name
        newItems[index].unitPrice = product.price
      }
    }
    
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return
    
    setIsLoading(true)

    const validItems = items.filter(item => item.description && item.quantity > 0)
    if (validItems.length === 0) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    const totalAmount = calculateTotal()

    // Update order
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        client_id: clientId === 'none' ? null : clientId,
        order_number: orderNumber,
        total_amount: totalAmount,
        order_date: orderDate,
        due_date: dueDate || null,
        status,
        notes: notes || null,
      })
      .eq('id', order.id)

    if (orderError) {
      setIsLoading(false)
      return
    }

    // Delete old items and insert new ones
    await supabase.from('order_items').delete().eq('order_id', order.id)

    const orderItems = validItems.map(item => ({
      order_id: order.id,
      product_id: item.productId === 'none' ? null : item.productId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))

    await supabase.from('order_items').insert(orderItems)

    setIsLoading(false)
    onOpenChange(false)
    onSuccess()
    router.refresh()
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
          <DialogDescription>Ubah detail order</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-order-number">Nomor Order</Label>
                <Input
                  id="edit-order-number"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-order-date">Tanggal Order</Label>
                <Input
                  id="edit-order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-due-date">Tanggal Kirim</Label>
                <Input
                  id="edit-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(val) => setStatus(val as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">Proses</SelectItem>
                    <SelectItem value="completed">Selesai</SelectItem>
                    <SelectItem value="cancelled">Batal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Item Order</Label>
              {items.map((item, index) => (
                <div key={index} className="rounded-lg border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Select
                      value={item.productId}
                      onValueChange={(val) => updateItem(index, 'productId', val)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Pilih produk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Custom Item</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Deskripsi item"
                        required
                      />
                    </div>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      placeholder="Qty"
                      min="1"
                      required
                    />
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="Harga satuan"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Item
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Catatan</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
