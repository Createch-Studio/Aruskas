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
// PERBAIKAN 1: Impor Badge yang sebelumnya menyebabkan eror
import { Badge } from '@/components/ui/badge' 
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

  // PERBAIKAN 2: Mencegah Hydration Error di Next.js (Vercel)
  const [isMounted, setIsMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('out')
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { description: '', quantity: 1, unitPrice: 0, isCustom: false }
  ])

  useEffect(() => {
    setIsMounted(true)
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

  // Render null jika belum mounted untuk menghindari mismatch HTML server vs client
  if (!isMounted) return null

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
    if (!clientId) return toast.error("Pilih supplier/unit terlebih dahulu")
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Unauthorized")

      if (transactionType === 'out') {
        for (const item of items) {
          if (!item.isCustom && item.inventoryId) {
            const stockItem = inventory.find(i => i.id === item.inventoryId)
            if (stockItem && stockItem.quantity < item.quantity) {
              throw new Error(`Stok tidak cukup: ${stockItem.name}`)
            }
          }
        }
      }

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

      await supabase.from('expenses').insert({
        user_id: user.id,
        amount: totalAmount,
        date: invoiceDate,
        category: 'Belanja Stok',
        description: `Otomatis: ${transactionType === 'in' ? 'Pembelian' : 'Pemakaian'} ${invoiceNumber}`,
        client_id: clientId,
        purchase_invoice_id: invoice.id 
      })

      toast.success("Transaksi berhasil dicatat")
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
            <DialogTitle className="text-xl font-bold">Invoice Belanja & Stok</DialogTitle>
            <DialogDescription>
              Tentukan tipe transaksi (Masuk/Keluar) untuk mengelola stok gudang.
            </DialogDescription>
          </DialogHeader>

          <div className="flex p-1 bg-slate-100 rounded-xl gap-1 border">
             <Button 
                type="button" 
                variant={transactionType === 'out' ? 'default' : 'ghost'}
                className={cn("flex-1 rounded-lg transition-all text-xs h-9", transactionType === 'out' ? "bg-white shadow-sm text-slate-900 hover:bg-white" : "text-slate-500")}
                onClick={() => setTransactionType('out')}
             >
                <ArrowUpRight className="h-3 w-3 mr-2 text-orange-500" />
                Pemakaian (Keluar)
             </Button>
             <Button 
                type="button" 
                variant={transactionType === 'in' ? 'default' : 'ghost'}
                className={cn("flex-1 rounded-lg transition-all text-xs h-9", transactionType === 'in' ? "bg-white shadow-sm text-slate-900 hover:bg-white" : "text-slate-500")}
                onClick={() => setTransactionType('in')}
             >
                <ArrowDownLeft className="h-3 w-3 mr-2 text-emerald-500" />
                Pembelian (Masuk)
             </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 text-left">
              <Label className="text-xs font-semibold">{transactionType === 'in' ? 'Suplier' : 'Unit Pemakai'}</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
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
            <div className="space-y-2 text-left">
              <Label className="text-xs font-semibold">No. Invoice</Label>
              <Input 
                className="bg-white"
                value={invoiceNumber} 
                onChange={(e) => setInvoiceNumber(e.target.value)} 
                placeholder="Contoh: INV-123" 
                required 
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Detail Item
              </h3>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])}>
                <Plus className="h-3 w-3 mr-1" /> Baris Baru
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="p-4 rounded-xl border bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
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
                        {item.isCustom ? "Kustom" : "Gudang"}
                    </Button>
                  {items.length > 1 && <Trash2 className="h-4 w-4 text-destructive cursor-pointer" onClick={() => setItems(items.filter((_, i) => i !== index))} />}
                </div>

                {!item.isCustom ? (
                  <Select value={item.inventoryId} onValueChange={(val) => handleUpdateItem(index, 'inventoryId', val)}>
                    <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Pilih barang..." /></SelectTrigger>
                    <SelectContent>
                      {inventory.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name} (Stok: {inv.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className="bg-white text-xs" placeholder="Nama barang kustom..." value={item.description} onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} />
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Qty</Label>
                    <Input type="number" className="bg-white text-xs" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Harga</Label>
                    <Input type="number" className="bg-white text-xs" value={item.unitPrice} onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px]">Total</Label>
                    <div className="h-10 flex items-center justify-end px-3 bg-white border rounded-md text-xs font-mono font-bold">
                        {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                </div>
                
                {!item.isCustom && item.inventoryId && (
                    <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[9px] py-0 font-normal">
                             Stok Akhir: {(inventory.find(i => i.id === item.inventoryId)?.quantity || 0) + (transactionType === 'in' ? item.quantity : -item.quantity)}
                        </Badge>
                    </div>
                )}
              </div>
            ))}
          </div>

          <div className={cn(
            "p-5 rounded-xl flex justify-between items-center text-white",
            transactionType === 'in' ? "bg-emerald-600" : "bg-slate-900"
          )}>
            <div>
                <p className="text-[10px] uppercase font-bold opacity-70">Total Transaksi</p>
                <p className="text-2xl font-black">{formatCurrency(totalAmount)}</p>
            </div>
            {transactionType === 'in' ? <ArrowDownLeft className="h-8 w-8 opacity-30" /> : <ArrowUpRight className="h-8 w-8 opacity-30" />}
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full py-6 text-base font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Simpan Transaksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}