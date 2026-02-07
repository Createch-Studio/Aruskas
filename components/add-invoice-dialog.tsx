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
import { Plus, Trash2, Package, Keyboard, Loader2, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
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
  
  // NEW: Toggle Type (In = Supplier to Warehouse, Out = Warehouse to Unit)
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('out')
  
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
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Unauthorized")

      // 1. VALIDASI STOK (Hanya jika Keluar/Out)
      if (transactionType === 'out') {
        for (const item of items) {
          if (!item.isCustom && item.inventoryId) {
            const stockItem = inventory.find(i => i.id === item.inventoryId)
            if (stockItem && stockItem.quantity < item.quantity) {
              throw new Error(`Stok tidak cukup: ${stockItem.name} (Sisa: ${stockItem.quantity})`)
            }
          }
        }
      }

      // 2. SIMPAN INVOICE UTAMA
      const { data: invoice, error: invErr } = await supabase
        .from('purchase_invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          description: description || (transactionType === 'in' ? 'Pembelian Stok Supplier' : 'Pemakaian Stok Internal'),
          total_amount: totalAmount,
          invoice_date: invoiceDate,
          status: 'used'
        })
        .select().single()

      if (invErr) throw invErr

      // 3. SIMPAN DETAIL ITEM
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

      // 4. UPDATE STOK DINAMIS (Tambah jika IN, Kurang jika OUT)
      for (const item of items) {
        if (!item.isCustom && item.inventoryId) {
          const stockItem = inventory.find(i => i.id === item.inventoryId)
          if (stockItem) {
            const newQty = transactionType === 'in' 
              ? stockItem.quantity + item.quantity 
              : stockItem.quantity - item.quantity
            
            await supabase.from('inventory').update({ quantity: newQty }).eq('id', item.inventoryId)
          }
        }
      }

      // 5. CATAT KE PENGELUARAN (EXPENSES)
      await supabase.from('expenses').insert({
        user_id: user.id,
        amount: totalAmount,
        date: invoiceDate,
        category: 'Belanja Stok',
        description: `Otomatis: ${transactionType === 'in' ? 'Pembelian' : 'Pemakaian'} ${invoiceNumber} (${clients.find(c => c.id === clientId)?.name})`,
        client_id: clientId,
        purchase_invoice_id: invoice.id 
      })

      toast.success(transactionType === 'in' ? "Stok berhasil bertambah" : "Stok berhasil dipotong")
      setOpen(false)
      onSuccess()
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-slate-900 hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" /> Input Transaksi Gudang
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Invoice Belanja & Stok</DialogTitle>
            <DialogDescription>
              Pilih tipe transaksi untuk menambah (Suplier) atau mengurangi (Pemakaian) stok.
            </DialogDescription>
          </DialogHeader>

          {/* TOGGLE TIPE TRANSAKSI */}
          <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
             <Button 
                type="button" 
                variant={transactionType === 'out' ? 'default' : 'ghost'}
                className={cn("flex-1 rounded-lg transition-all", transactionType === 'out' && "shadow-sm")}
                onClick={() => setTransactionType('out')}
             >
                <ArrowUpRight className="h-4 w-4 mr-2 text-orange-500" />
                Pemakaian (Keluar)
             </Button>
             <Button 
                type="button" 
                variant={transactionType === 'in' ? 'default' : 'ghost'}
                className={cn("flex-1 rounded-lg transition-all", transactionType === 'in' && "shadow-sm")}
                onClick={() => setTransactionType('in')}
             >
                <ArrowDownLeft className="h-4 w-4 mr-2 text-emerald-500" />
                Pembelian (Masuk)
             </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{transactionType === 'in' ? 'Suplier' : 'Unit Pemakai'}</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger><SelectValue placeholder="Pilih entitas" /></SelectTrigger>
                <SelectContent>
                  <Input placeholder="Cari..." className="m-2 h-8 w-[calc(100%-1rem)]" onChange={(e) => setClientSearch(e.target.value)} />
                  {filteredClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nomor Invoice / Referensi</Label>
              <Input 
                value={invoiceNumber} 
                onChange={(e) => setInvoiceNumber(e.target.value)} 
                placeholder={transactionType === 'in' ? "INV-SUP-001" : "OUT-001"} 
                required 
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Daftar Barang {transactionType === 'in' ? 'Masuk' : 'Keluar'}
              </h3>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])}>
                <Plus className="h-3 w-3 mr-1" /> Tambah Baris
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="p-4 rounded-xl border bg-slate-50/50 space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        size="sm" 
                        className={cn("h-6 text-[9px] font-bold uppercase", item.isCustom ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}
                        onClick={() => {
                            const newItems = [...items];
                            newItems[index].isCustom = !newItems[index].isCustom;
                            newItems[index].inventoryId = undefined;
                            setItems(newItems);
                        }}
                    >
                        {item.isCustom ? "Custom" : "Gudang"}
                    </Button>
                  </div>
                  {items.length > 1 && <Trash2 className="h-4 w-4 text-destructive cursor-pointer hover:scale-110 transition-transform" onClick={() => setItems(items.filter((_, i) => i !== index))} />}
                </div>

                {!item.isCustom ? (
                  <Select value={item.inventoryId} onValueChange={(val) => handleUpdateItem(index, 'inventoryId', val)}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih barang dari gudang..." /></SelectTrigger>
                    <SelectContent>
                      {inventory.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name} (Stok: {inv.quantity} {inv.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className="bg-white" placeholder="Nama barang kustom..." value={item.description} onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} />
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Qty</Label>
                    <Input type="number" className="bg-white" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Harga Satuan</Label>
                    <Input type="number" className="bg-white" value={item.unitPrice} onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Subtotal</Label>
                    <div className="h-10 flex items-center px-3 bg-slate-100 border rounded-md text-xs font-mono font-bold">
                        {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                </div>
                
                {!item.isCustom && item.inventoryId && (
                    <div className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-[9px] py-0 font-normal border-slate-300">
                             <AlertCircle className="h-2 w-2 mr-1 text-slate-500" />
                             Estimasi Stok Akhir: {(inventory.find(i => i.id === item.inventoryId)?.quantity || 0) + (transactionType === 'in' ? item.quantity : -item.quantity)}
                        </Badge>
                    </div>
                )}
              </div>
            ))}
          </div>

          <div className={cn(
            "p-4 rounded-xl flex justify-between items-center shadow-sm text-white",
            transactionType === 'in' ? "bg-emerald-600" : "bg-slate-900"
          )}>
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold opacity-70">Total Nilai {transactionType === 'in' ? 'Masuk' : 'Keluar'}</span>
                <span className="text-xl font-black tracking-tight">{formatCurrency(totalAmount)}</span>
            </div>
            {transactionType === 'in' ? <ArrowDownLeft className="h-8 w-8 opacity-20" /> : <ArrowUpRight className="h-8 w-8 opacity-20" />}
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full py-7 text-lg font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : (transactionType === 'in' ? "Tambah Stok ke Gudang" : "Simpan & Potong Stok")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}