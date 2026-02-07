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
import { Plus, Trash2, Package, Keyboard, Loader2 } from 'lucide-react'
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

/**
 * Utility untuk memformat mata uang IDR
 */
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

  // --- States ---
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [clientSearch, setClientSearch] = useState('')
  
  // Form States
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { description: '', quantity: 1, unitPrice: 0, isCustom: false }
  ])

  // --- Effects ---
  useEffect(() => {
    if (open) fetchInitialData()
  }, [open])

  const fetchInitialData = async () => {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true })
    if (data) setInventory(data)
  }

  // --- Memos ---
  const filteredClients = useMemo(() => 
    clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())),
    [clients, clientSearch]
  )

  const totalAmount = useMemo(() => 
    items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
    [items]
  )

  // --- Handlers ---
  const handleAddItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: keyof InvoiceItemInput, value: any) => {
    setItems(prev => {
      const newItems = [...prev]
      
      // Jika pilih dari inventory, auto-fill description & price tapi jangan di-lock
      if (field === 'inventoryId' && !newItems[index].isCustom) {
        const product = inventory.find(p => p.id === value)
        if (product) {
          newItems[index] = {
            ...newItems[index],
            inventoryId: value,
            description: product.name,
            unitPrice: product.unit_cost, // Default harga modal, tapi bisa diedit nanti
          }
        }
      } else {
        newItems[index] = { ...newItems[index], [field]: value }
      }
      return newItems
    })
  }

  const toggleMode = (index: number) => {
    setItems(prev => {
      const newItems = [...prev]
      newItems[index].isCustom = !newItems[index].isCustom
      newItems[index].inventoryId = undefined // Reset jika pindah mode
      return newItems
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.some(item => !item.description || item.unitPrice <= 0)) {
      return alert("Mohon lengkapi detail item dan harga.")
    }

    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Unauthorized")

      // 1. Insert Purchase Invoice
      const { data: invoice, error: invErr } = await supabase
        .from('purchase_invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          description,
          total_amount: totalAmount,
          invoice_date: invoiceDate,
        })
        .select().single()

      if (invErr) throw invErr

      // 2. Insert Items & Update Stok
      const itemPayload = items.map(item => ({
        purchase_invoice_id: invoice.id,
        inventory_id: item.isCustom ? null : item.inventoryId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice
      }))

      const { error: itemErr } = await supabase.from('purchase_invoice_items').insert(itemPayload)
      if (itemErr) throw itemErr

      // 3. Update Inventory (Stok Tambah & Update Harga Modal Terbaru)
      for (const item of items) {
        if (!item.isCustom && item.inventoryId) {
          const currentItem = inventory.find(i => i.id === item.inventoryId)
          if (currentItem) {
            await supabase
              .from('inventory')
              .update({ 
                quantity: currentItem.quantity + item.quantity,
                unit_cost: item.unitPrice // Harga fluktuatif terbaru disimpan
              })
              .eq('id', item.inventoryId)
          }
        }
      }

      setOpen(false)
      onSuccess()
      router.refresh()
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan invoice")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-semibold shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Belanja
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Invoice Belanja Baru</DialogTitle>
            <DialogDescription>
              Catat pembelian stok atau biaya operasional. Harga inventory akan otomatis terupdate jika diubah.
            </DialogDescription>
          </DialogHeader>

          {/* Form Utama */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier / Client</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                <SelectContent>
                  <Input 
                    placeholder="Cari..." 
                    className="m-2 h-8 w-[calc(100%-1rem)]"
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  {filteredClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>No. Invoice Supplier</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Contoh: INV-9901" required />
            </div>
          </div>

          {/* List Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Rincian Item</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-1" /> Tambah Baris
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="p-4 rounded-xl border bg-card shadow-sm space-y-4 transition-all hover:border-primary/50">
                <div className="flex items-center justify-between">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold"
                    onClick={() => toggleMode(index)}
                  >
                    {item.isCustom ? <Keyboard className="h-3 w-3 mr-1" /> : <Package className="h-3 w-3 mr-1" />}
                    {item.isCustom ? "MODE KUSTOM" : "MODE INVENTORY"}
                  </Button>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4">
                  {!item.isCustom ? (
                    <Select value={item.inventoryId} onValueChange={(val) => handleUpdateItem(index, 'inventoryId', val)}>
                      <SelectTrigger><SelectValue placeholder="Pilih barang dari gudang..." /></SelectTrigger>
                      <SelectContent>
                        {inventory.map(inv => (
                          <SelectItem key={inv.id} value={inv.id}>{inv.name} (Stok: {inv.quantity})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      placeholder="Nama barang/biaya kustom..." 
                      value={item.description} 
                      onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} 
                    />
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Jumlah</Label>
                      <Input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Harga Satuan</Label>
                      <Input 
                        type="number" 
                        className="font-mono text-blue-600 focus-visible:ring-blue-500"
                        value={item.unitPrice} 
                        onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subtotal</Label>
                      <div className="h-10 flex items-center px-3 bg-muted/50 rounded-md border font-mono text-xs">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Summary */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-lg">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Total Pembelian</p>
              <p className="text-xs text-slate-400 italic">Terintegrasi ke Pengeluaran & Stok</p>
            </div>
            <span className="text-2xl font-black">{formatCurrency(totalAmount)}</span>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full h-12 text-base shadow-xl" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Konfirmasi & Simpan Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}