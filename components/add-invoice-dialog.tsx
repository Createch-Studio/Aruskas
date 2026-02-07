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
import { toast } from "sonner"

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

  // --- States ---
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

  // --- Data Fetching ---
  useEffect(() => {
    if (open) fetchInventory()
  }, [open])

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('name')
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
    if (items.some(i => i.quantity <= 0 || (!i.isCustom && !i.inventoryId))) {
      return toast.error("Mohon lengkapi item dan jumlah barang.")
    }

    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Unauthorized")

      // 1. Validasi Stok (Mencegah stok negatif)
      for (const item of items) {
        if (!item.isCustom && item.inventoryId) {
          const stockItem = inventory.find(i => i.id === item.inventoryId)
          if (stockItem && stockItem.quantity < item.quantity) {
            throw new Error(`Stok tidak cukup: ${stockItem.name} (Sisa: ${stockItem.quantity})`)
          }
        }
      }

      const selectedClient = clients.find(c => c.id === clientId)

      // 2. Simpan Purchase Invoice Utama
      const { data: invoice, error: invErr } = await supabase
        .from('purchase_invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          description: description || 'Pemakaian Stok Gudang',
          total_amount: totalAmount,
          invoice_date: invoiceDate,
          status: 'used'
        })
        .select().single()

      if (invErr) throw invErr

      // 3. Simpan Detail Item Invoice
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

      // 4. Update Stok Inventory (BERKURANG)
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

      // 5. Otomatis Catat ke Pengeluaran (EXPENSES)
      const { error: expErr } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          amount: totalAmount,
          date: invoiceDate,
          category: 'Belanja Stok',
          description: `Otomatis: Belanja ${invoiceNumber} (${selectedClient?.name || 'Internal'})`,
          client_id: clientId,
          purchase_invoice_id: invoice.id // Link ID untuk kemudahan edit/hapus nantinya
        })

      if (expErr) console.error("Expense Sync Error:", expErr)

      toast.success("Invoice berhasil disimpan & Stok diperbarui")
      setOpen(false)
      onSuccess()
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Input Pemakaian Stok
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Input Pemakaian / Belanja Internal</DialogTitle>
            <DialogDescription>
              Setiap barang yang diambil akan **mengurangi stok** gudang dan mencatat **pengeluaran**.
            </DialogDescription>
          </DialogHeader>

          {/* Header Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit Pemakai / Supplier</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger><SelectValue placeholder="Pilih unit..." /></SelectTrigger>
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
              <Label>Nomor Referensi</Label>
              <Input 
                value={invoiceNumber} 
                onChange={(e) => setInvoiceNumber(e.target.value)} 
                placeholder="Contoh: OUT-1002" 
                required 
              />
            </div>
          </div>

          {/* Item List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Daftar Barang</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Tambah Baris
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="p-4 rounded-xl border bg-slate-50/50 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    className={cn("h-7 text-[10px] font-bold", item.isCustom ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}
                    onClick={() => {
                        const newItems = [...items];
                        newItems[index].isCustom = !newItems[index].isCustom;
                        newItems[index].inventoryId = undefined;
                        setItems(newItems);
                    }}
                  >
                    {item.isCustom ? "MODE KUSTOM" : "MODE GUDANG"}
                  </Button>
                  {items.length > 1 && (
                    <Trash2 
                      className="h-4 w-4 text-destructive cursor-pointer hover:scale-110 transition-transform" 
                      onClick={() => setItems(items.filter((_, i) => i !== index))} 
                    />
                  )}
                </div>

                {!item.isCustom ? (
                  <Select value={item.inventoryId} onValueChange={(val) => handleUpdateItem(index, 'inventoryId', val)}>
                    <SelectTrigger><SelectValue placeholder="Pilih barang di gudang..." /></SelectTrigger>
                    <SelectContent>
                      {inventory.map(inv => (
                        <SelectItem key={inv.id} value={inv.id} disabled={inv.quantity <= 0}>
                          {inv.name} (Stok: {inv.quantity} {inv.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    placeholder="Nama barang atau biaya operasional..." 
                    value={item.description} 
                    onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} 
                  />
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Qty</Label>
                    <Input 
                      type="number" 
                      value={item.quantity} 
                      onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Harga Satuan</Label>
                    <Input 
                      type="number" 
                      value={item.unitPrice} 
                      onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px] font-bold">Subtotal</Label>
                    <div className="h-10 flex items-center justify-end px-3 bg-white border rounded-md text-xs font-mono font-bold">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                </div>

                {/* Real-time Stock Warning */}
                {!item.isCustom && item.inventoryId && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-white/50 p-2 rounded border border-dashed">
                        <AlertCircle className="h-3 w-3 text-blue-500" />
                        Sisa stok di gudang setelah ini: 
                        <span className={cn("font-bold", (inventory.find(i => i.id === item.inventoryId)?.quantity || 0) - item.quantity < 0 ? "text-destructive" : "text-green-600")}>
                           {(inventory.find(i => i.id === item.inventoryId)?.quantity || 0) - item.quantity}
                        </span>
                    </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Summary */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-lg">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Total Nilai Pemakaian</p>
              <p className="text-[9px] text-slate-500 italic">Otomatis masuk ke laporan pengeluaran</p>
            </div>
            <span className="text-2xl font-black">{formatCurrency(totalAmount)}</span>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full h-12 text-base font-bold shadow-xl" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sedang Memproses...</> : "Konfirmasi & Potong Stok"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}