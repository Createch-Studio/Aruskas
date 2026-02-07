'use client'

import React, { useState, useEffect, useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Package, Keyboard, Loader2, AlertCircle } from 'lucide-react'
import type { Client, InventoryItem } from '@/lib/types'
import { cn } from "@/lib/utils"

interface InvoiceItemInput {
  inventoryId?: string
  description: string
  quantity: number
  unitPrice: number
  isCustom: boolean
}

interface AddInvoiceDialogProps {
  clients: Client[]
  onSuccess: () => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function AddInvoiceDialog({ clients, onSuccess }: AddInvoiceDialogProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [clientSearch, setClientSearch] = useState('')
  
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { description: '', quantity: 1, unitPrice: 0, isCustom: false }
  ])

  useEffect(() => {
    if (open) fetchInventory()
  }, [open])

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('name')
    if (data) setInventory(data)
  }

  const filteredClients = useMemo(() => 
    clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())),
    [clients, clientSearch]
  )

  const totalAmount = useMemo(() => 
    items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
    [items]
  )

  const handleUpdateItem = (index: number, field: keyof InvoiceItemInput, value: any) => {
    setItems(prev => {
      const newItems = [...prev]
      if (field === 'inventoryId' && !newItems[index].isCustom) {
        const product = inventory.find(p => p.id === value)
        if (product) {
          newItems[index] = {
            ...newItems[index],
            inventoryId: value,
            description: product.name,
            unitPrice: product.unit_cost,
          }
        }
      } else {
        newItems[index] = { ...newItems[index], [field]: value }
      }
      return newItems
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Unauthorized")

      // Validasi Stok Sebelum Proses
      for (const item of items) {
        if (!item.isCustom && item.inventoryId) {
          const stockItem = inventory.find(i => i.id === item.inventoryId)
          if (stockItem && stockItem.quantity < item.quantity) {
            throw new Error(`Stok tidak cukup untuk: ${stockItem.name} (Tersedia: ${stockItem.quantity})`)
          }
        }
      }

      // 1. Simpan Invoice Utama
      const { data: invoice, error: invErr } = await supabase
        .from('purchase_invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          description: description || 'Pemakaian Stok Internal',
          total_amount: totalAmount,
          invoice_date: invoiceDate,
        })
        .select().single()

      if (invErr) throw invErr

      // 2. Simpan Detail Item
      const { error: itemErr } = await supabase.from('purchase_invoice_items').insert(
        items.map(item => ({
          purchase_invoice_id: invoice.id,
          inventory_id: item.isCustom ? null : item.inventoryId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice
        }))
      )
      if (itemErr) throw itemErr

      // 3. UPDATE STOK (BERKURANG)
      for (const item of items) {
        if (!item.isCustom && item.inventoryId) {
          const stockItem = inventory.find(i => i.id === item.inventoryId)
          if (stockItem) {
            await supabase
              .from('inventory')
              .update({ quantity: stockItem.quantity - item.quantity })
              .eq('id', item.inventoryId)
          }
        }
      }

      setOpen(false)
      onSuccess()
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default"><Plus className="mr-2 h-4 w-4" /> Input Pemakaian Gudang</Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Input Invoice Belanja (Ambil Stok)</DialogTitle>
            <DialogDescription>
              Mencatat biaya penggunaan bahan baku. **Stok di gudang akan otomatis berkurang.**
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client / Unit Pemakai</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger><SelectValue placeholder="Pilih pemakai" /></SelectTrigger>
                <SelectContent>
                  <Input placeholder="Cari..." className="m-2 h-8 w-[calc(100%-1rem)]" onChange={(e) => setClientSearch(e.target.value)} />
                  {filteredClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nomor Referensi/Invoice</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Contoh: OUT-001" required />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-muted-foreground uppercase">Rincian Barang Keluar</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])}>
                <Plus className="h-4 w-4 mr-1" /> Baris Baru
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="p-4 rounded-lg border bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className={cn("h-7 text-[10px]", item.isCustom ? "text-orange-600" : "text-blue-600")}
                    onClick={() => {
                        const newItems = [...items];
                        newItems[index].isCustom = !newItems[index].isCustom;
                        newItems[index].inventoryId = undefined;
                        setItems(newItems);
                    }}
                  >
                    {item.isCustom ? <Keyboard className="h-3 w-3 mr-1" /> : <Package className="h-3 w-3 mr-1" />}
                    {item.isCustom ? "KUSTOM (NON-STOK)" : "AMBIL DARI GUDANG"}
                  </Button>
                  {items.length > 1 && <Trash2 className="h-4 w-4 text-destructive cursor-pointer" onClick={() => setItems(items.filter((_, i) => i !== index))} />}
                </div>

                {!item.isCustom ? (
                  <Select value={item.inventoryId} onValueChange={(val) => handleUpdateItem(index, 'inventoryId', val)}>
                    <SelectTrigger><SelectValue placeholder="Pilih barang..." /></SelectTrigger>
                    <SelectContent>
                      {inventory.map(inv => (
                        <SelectItem key={inv.id} value={inv.id} disabled={inv.quantity <= 0}>
                          {inv.name} (Stok: {inv.quantity} {inv.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Nama biaya/barang..." value={item.description} onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} />
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[10px]">Jumlah</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Harga Satuan (Edit jika fluktuatif)</Label>
                    <Input type="number" value={item.unitPrice} onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Subtotal</Label>
                    <div className="h-10 flex items-center px-3 bg-white border rounded-md text-xs font-mono">{formatCurrency(item.quantity * item.unitPrice)}</div>
                  </div>
                </div>
                {!item.isCustom && item.inventoryId && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Stok tersisa setelah ini: {(inventory.find(i => i.id === item.inventoryId)?.quantity || 0) - item.quantity}
                    </p>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-primary text-primary-foreground flex justify-between items-center">
            <span className="font-bold">Total Nilai Pemakaian</span>
            <span className="text-xl font-black">{formatCurrency(totalAmount)}</span>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full py-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Simpan & Potong Stok Gudang"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}