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
import type { Client, Product } from '@/lib/types'

interface AddOrderDialogProps {
  clients: Client[]
  products: Product[]
  onSuccess: () => void
}

interface OrderItemInput {
  productId: string
  description: string
  quantity: number
  unitPrice: number
}

export function AddOrderDialog({ clients, products, onSuccess }: AddOrderDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clientId, setClientId] = useState<string>('none')
  const [orderNumber, setOrderNumber] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<OrderItemInput[]>([
    { productId: 'none', description: '', quantity: 1, unitPrice: 0 }
  ])
  const router = useRouter()

  const addItem = () => {
    setItems([...items, { productId: 'none', description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof OrderItemInput, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Auto-fill description and price when product is selected
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
    setIsLoading(true)

    console.log('[v0] Starting order submission')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[v0] No user found')
        setIsLoading(false)
        return
      }

      const validItems = items.filter(item => item.description && item.quantity > 0)
      if (validItems.length === 0) {
        console.log('[v0] No valid items')
        alert('Tambahkan minimal 1 item dengan deskripsi dan qty')
        setIsLoading(false)
        return
      }

      const totalAmount = calculateTotal()
      console.log('[v0] Total amount:', totalAmount)

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          client_id: clientId === 'none' ? null : clientId,
          order_number: orderNumber,
          total_amount: totalAmount,
          order_date: orderDate,
          due_date: dueDate || null,
          status: 'pending',
          notes: notes || null,
        })
        .select()
        .single()

      if (orderError) {
        console.error('[v0] Order error:', orderError)
        alert(`Error: ${orderError.message}`)
        setIsLoading(false)
        return
      }

      if (!order) {
        console.error('[v0] No order returned')
        alert('Error: Gagal membuat order')
        setIsLoading(false)
        return
      }

      console.log('[v0] Order created:', order.id)

      // Create order items
      const orderItems = validItems.map(item => ({
        order_id: order.id,
        product_id: item.productId === 'none' ? null : item.productId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      
      if (itemsError) {
        console.error('[v0] Items error:', itemsError)
        alert(`Error items: ${itemsError.message}`)
        setIsLoading(false)
        return
      }

      console.log('[v0] Order items created')

      setOpen(false)
      setClientId('none')
      setOrderNumber('')
      setOrderDate(new Date().toISOString().split('T')[0])
      setDueDate('')
      setNotes('')
      setItems([{ productId: 'none', description: '', quantity: 1, unitPrice: 0 }])
      onSuccess()
      router.refresh()
    } catch (error) {
      console.error('[v0] Unexpected error:', error)
      alert('Terjadi error yang tidak terduga')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Order Baru</DialogTitle>
          <DialogDescription>Catat order masuk dari client</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="order-number">Nomor Order</Label>
                <Input
                  id="order-number"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ORD-001"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="order-date">Tanggal Order</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due-date">Tanggal Kirim (opsional)</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Deskripsi (opsional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat order"
              />
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
                        <SelectValue placeholder="Pilih produk (opsional)" />
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
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
