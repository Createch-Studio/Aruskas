'use client'

import React from "react"

import { useState, useEffect } from 'react'
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
import type { Product, Client, Sale, SaleItem, PurchaseInvoice } from '@/lib/types'

interface EditSaleDialogProps {
  sale: Sale | null
  products: Product[]
  clients: Client[]
  invoices: PurchaseInvoice[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface SaleItemInput {
  id?: string
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

export function EditSaleDialog({ sale, products, clients, invoices, open, onOpenChange, onSuccess }: EditSaleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<SaleItemInput[]>([])
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [clientId, setClientId] = useState<string>('none')
  const [invoiceId, setInvoiceId] = useState<string>('none')
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string | null>(null)

  // Get available invoices for selected client (pending status only OR the current invoice)
  const availableInvoices = invoices.filter(
    inv => (inv.status === 'pending' || inv.id === originalInvoiceId) && 
           (clientId === 'none' || inv.client_id === clientId)
  )

  // Get selected invoice amount for additional cost
  const selectedInvoice = invoices.find(inv => inv.id === invoiceId)
  const additionalCost = selectedInvoice?.total_amount || 0

  useEffect(() => {
    if (sale) {
      setNotes(sale.notes || '')
      setSaleDate(sale.sale_date?.split('T')[0] || new Date().toISOString().split('T')[0])
      setClientId(sale.client_id || 'none')
      setInvoiceId(sale.purchase_invoice_id || 'none')
      setOriginalInvoiceId(sale.purchase_invoice_id || null)
      
      if (sale.items && sale.items.length > 0) {
        setItems(sale.items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          quantity: item.quantity,
          customPrice: item.unit_price,
          customCost: item.unit_cost,
        })))
      } else {
        setItems([{ productId: '', quantity: 1, customPrice: null, customCost: null }])
      }
    }
  }, [sale])

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
      const product = products.find((p) => p.id === value)
      if (product) {
        newItems[index].customPrice = product.price
        newItems[index].customCost = product.cost
      }
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

    // Add invoice amount to total cost
    totalCost += additionalCost

    return { totalAmount, totalCost, additionalCost }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sale) return
    setIsLoading(true)

    console.log('[v0] Starting edit sale submission')

    try {
      const supabase = createClient()

      const validItems = items.filter((item) => item.productId && item.quantity > 0)
      if (validItems.length === 0) {
        console.log('[v0] No valid items')
        alert('Tambahkan minimal 1 item dengan produk dan qty')
        setIsLoading(false)
        return
      }

      const { totalAmount, totalCost, additionalCost: addCost } = calculateTotals()
      console.log('[v0] Totals:', { totalAmount, totalCost, addCost })

      // Update sale
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          client_id: clientId === 'none' ? null : clientId,
          purchase_invoice_id: invoiceId === 'none' ? null : invoiceId,
          total_amount: totalAmount,
          total_cost: totalCost,
          additional_cost: addCost,
          notes: notes || null,
          sale_date: saleDate,
        })
        .eq('id', sale.id)

      if (saleError) {
        console.error('[v0] Sale update error:', saleError)
        alert(`Error update sale: ${saleError.message}`)
        setIsLoading(false)
        return
      }

      console.log('[v0] Sale updated')

      // Handle invoice status changes
      if (originalInvoiceId && originalInvoiceId !== invoiceId) {
        const { error: resetError } = await supabase
          .from('purchase_invoices')
          .update({ status: 'pending' })
          .eq('id', originalInvoiceId)
        
        if (resetError) {
          console.error('[v0] Reset invoice error:', resetError)
        }
      }
      if (invoiceId !== 'none' && invoiceId !== originalInvoiceId) {
        const { error: useError } = await supabase
          .from('purchase_invoices')
          .update({ status: 'used' })
          .eq('id', invoiceId)
        
        if (useError) {
          console.error('[v0] Use invoice error:', useError)
        }
      }

      // Delete old sale items
      const { error: deleteError } = await supabase.from('sale_items').delete().eq('sale_id', sale.id)
      if (deleteError) {
        console.error('[v0] Delete items error:', deleteError)
        alert(`Error hapus items lama: ${deleteError.message}`)
        setIsLoading(false)
        return
      }

      console.log('[v0] Old items deleted')

      // Insert new sale items
      const saleItems = validItems.map((item) => {
        const product = products.find(p => p.id === item.productId)
        const unitPrice = getItemPrice(item)
        const unitCost = getItemCost(item)
        return {
          sale_id: sale.id,
          product_id: item.productId,
          product_name: product?.name || 'Unknown Product',
          quantity: item.quantity,
          unit_price: unitPrice,
          unit_cost: unitCost,
          total_price: unitPrice * item.quantity,
        }
      })

      const { error: insertError } = await supabase.from('sale_items').insert(saleItems)
      if (insertError) {
        console.error('[v0] Insert items error:', insertError)
        alert(`Error simpan items baru: ${insertError.message}`)
        setIsLoading(false)
        return
      }

      console.log('[v0] New items inserted')

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('[v0] Unexpected error:', error)
      alert('Terjadi error yang tidak terduga')
    } finally {
      setIsLoading(false)
    }
  }

  const { totalAmount, totalCost } = calculateTotals()
  const profit = totalAmount - totalCost

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Penjualan</DialogTitle>
          <DialogDescription>Perbarui data transaksi penjualan</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-sale-date">Tanggal</Label>
                <Input
                  id="edit-sale-date"
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Client (opsional)</Label>
                <Select value={clientId} onValueChange={(val) => {
                  setClientId(val)
                  setInvoiceId('none')
                }}>
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

            {availableInvoices.length > 0 && (
              <div className="grid gap-2">
                <Label>Invoice Belanja (opsional)</Label>
                <Select value={invoiceId} onValueChange={setInvoiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih invoice belanja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Invoice</SelectItem>
                    {availableInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.client?.name} ({formatCurrency(invoice.total_amount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Invoice belanja akan ditambahkan sebagai biaya tambahan ke harga modal
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label>Item Penjualan</Label>
              {items.map((item, index) => {
                const selectedProduct = products.find((p) => p.id === item.productId)
                return (
                  <div key={index} className="rounded-lg border p-3 space-y-2">
                    <div className="flex gap-2">
                      <Select
                        value={item.productId}
                        onValueChange={(value) => updateItem(index, 'productId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Pilih produk" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - {formatCurrency(product.price)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-20"
                        placeholder="Qty"
                      />
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {selectedProduct && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Harga Jual</Label> 
                          <Input
                            type="number"
                            value={item.customPrice ?? selectedProduct.price}
                            onChange={(e) => updateItem(index, 'customPrice', e.target.value ? parseFloat(e.target.value) : null)}
                            min="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Packaging Cost</Label>
                          <Input
                            type="number"
                            value={item.customCost ?? selectedProduct.cost}
                            onChange={(e) => updateItem(index, 'customCost', e.target.value ? parseFloat(e.target.value) : null)}
                            min="0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Item
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Catatan (opsional)</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
                rows={2}
              />
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Penjualan:</span>
                <span className="font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Modal Produk:</span>
                <span className="font-medium">{formatCurrency(totalCost - additionalCost)}</span>
              </div>
              {additionalCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Biaya Invoice Belanja:</span>
                  <span className="font-medium">{formatCurrency(additionalCost)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Total Modal:</span>
                <span className="font-medium">{formatCurrency(totalCost)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Profit:</span>
                <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>
                  {formatCurrency(profit)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || items.every((i) => !i.productId)}>
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
