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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { Client, PurchaseInvoice } from '@/lib/types'

interface InvoiceItemInput {
  id?: string
  description: string
  quantity: number
  unitPrice: number
}

interface EditInvoiceDialogProps {
  invoice: PurchaseInvoice | null
  clients: Client[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function EditInvoiceDialog({ invoice, clients, open, onOpenChange, onSuccess }: EditInvoiceDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [status, setStatus] = useState<'pending' | 'used' | 'cancelled'>('pending')
  const [items, setItems] = useState<InvoiceItemInput[]>([])
  const router = useRouter()

  useEffect(() => {
    if (invoice) {
      setClientId(invoice.client_id)
      setInvoiceNumber(invoice.invoice_number)
      setDescription(invoice.description || '')
      setInvoiceDate(invoice.invoice_date.split('T')[0])
      setStatus(invoice.status)
      setItems(
        invoice.items?.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })) || [{ description: '', quantity: 1, unitPrice: 0 }]
      )
    }
  }, [invoice])

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof InvoiceItemInput, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return
    
    setIsLoading(true)

    const supabase = createClient()

    const validItems = items.filter(item => item.description.trim() && item.unitPrice > 0)

    if (validItems.length === 0) {
      setIsLoading(false)
      return
    }

    const totalAmount = calculateTotal()

    // Update invoice
    const { error: invoiceError } = await supabase
      .from('purchase_invoices')
      .update({
        client_id: clientId,
        invoice_number: invoiceNumber,
        description: description || null,
        total_amount: totalAmount,
        invoice_date: invoiceDate,
        status: status,
      })
      .eq('id', invoice.id)

    if (invoiceError) {
      setIsLoading(false)
      return
    }

    // Delete existing items
    await supabase
      .from('purchase_invoice_items')
      .delete()
      .eq('purchase_invoice_id', invoice.id)

    // Create new invoice items
    const invoiceItems = validItems.map((item) => ({
      purchase_invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))

    await supabase.from('purchase_invoice_items').insert(invoiceItems)

    setIsLoading(false)
    onOpenChange(false)
    onSuccess()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Invoice Belanja</DialogTitle>
            <DialogDescription>
              Ubah data invoice belanja bahan baku
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-client">Client</Label>
                <Select value={clientId} onValueChange={setClientId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-invoice-number">Nomor Invoice</Label>
                <Input
                  id="edit-invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-001"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-invoice-date">Tanggal</Label>
                <Input
                  id="edit-invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={status} onValueChange={(value: 'pending' | 'used' | 'cancelled') => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="used">Digunakan</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Deskripsi</Label>
                <Input
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi invoice"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Item Belanja</Label>
              {items.map((item, index) => (
                <div key={index} className="rounded-lg border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Nama item/bahan"
                      className="flex-1"
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
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) =>
                        updateItem(index, 'quantity', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Harga Satuan</Label>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Subtotal</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Item
              </Button>
            </div>

            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="font-medium">Total Invoice</span>
              <span className="text-lg font-bold">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || !clientId || !invoiceNumber}>
              {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
