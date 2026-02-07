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
import type { Client, PurchaseInvoice, InventoryItem } from '@/lib/types'
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface InvoiceItemInput {
  id?: string
  inventoryId?: string
  description: string
  quantity: number
  unitPrice: number
  isCustom: boolean
}

interface EditInvoiceDialogProps {
  invoice: PurchaseInvoice | null
  clients: Client[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function EditInvoiceDialog({ invoice, clients, open, onOpenChange, onSuccess }: EditInvoiceDialogProps) {
  const router = useRouter()
  const supabase = createClient()

  // --- States ---
  const [isLoading, setIsLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [status, setStatus] = useState<'pending' | 'used' | 'cancelled'>('pending')
  const [items, setItems] = useState<InvoiceItemInput[]>([])

  // --- Initial Load ---
  useEffect(() => {
    if (open) fetchInventory()
    if (invoice && open) {
      setClientId(invoice.client_id)
      setInvoiceNumber(invoice.invoice_number)
      setDescription(invoice.description || '')
      setInvoiceDate(invoice.invoice_date.split('T')[0])
      setStatus(invoice.status)
      setItems(
        invoice.items?.map(item => ({
          id: item.id,
          inventoryId: item.inventory_id || undefined,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          isCustom: !item.inventory_id
        })) || []
      )
    }
  }, [invoice, open])

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('name')
    if (data) setInventory(data)
  }

  const totalAmount = useMemo(() => 
    items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
    [items]
  )

  // --- Handlers ---
  const handleUpdateItem = (index: number, field: keyof InvoiceItemInput, value: any) => {
    setItems(prev => {
      const newItems = [...prev]
      if (field === 'inventoryId' && !newItems[index].isCustom) {
        const prod = inventory.find(p => p.id === value)
        if (prod) {
          newItems[index] = { ...newItems[index], inventoryId: value, description: prod.name, unitPrice: prod.unit_cost }
        }
      } else {
        newItems[index] = { ...newItems[index], [field]: value }
      }
      return newItems
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Unauthorized")

      // 1. REVERT STOK LAMA
      // Mengembalikan stok ke kondisi sebelum invoice ini dibuat
      if (invoice.items) {
        for (const oldItem of invoice.items) {
          if (oldItem.inventory_id) {
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', oldItem.inventory_id).single()
            if (inv) {
              await supabase.from('inventory').update({ quantity: inv.quantity + oldItem.quantity }).eq('id', oldItem.inventory_id)
            }
          }
        }
      }

      // 2. VALIDASI STOK BARU (Setelah Revert)
      for (const item of items) {
        if (!item.isCustom && item.inventoryId) {
          const { data: inv } = await supabase.from('inventory').select('name, quantity').eq('id', item.inventoryId).single()
          if (inv && inv.quantity < item.quantity) {
            throw new Error(`Stok tidak cukup untuk: ${inv.name} (Tersedia: ${inv.quantity})`)
          }
        }
      }

      // 3. UPDATE INVOICE UTAMA
      const { error: invErr } = await supabase
        .from('purchase_invoices')
        .update({
          client_id: clientId,
          invoice_number: invoiceNumber,
          description,
          total_amount: totalAmount,
          invoice_date: invoiceDate,
          status
        })
        .eq('id', invoice.id)
      if (invErr) throw invErr

      // 4. SYNC ITEMS (Hapus dan Pasang Baru)
      await supabase.from('purchase_invoice_items').delete().eq('purchase_invoice_id', invoice.id)
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

      // 5. POTONG STOK BARU (Kecuali status Dibatalkan)
      if (status !== 'cancelled') {
        for (const item of items) {
          if (!item.isCustom && item.inventoryId) {
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', item.inventoryId).single()
            if (inv) {
              await supabase.from('inventory').update({ quantity: inv.quantity - item.quantity }).eq('id', item.inventoryId)
            }
          }
        }
      }

      // 6. SYNC EXPENSES (Laporan Pengeluaran)
      // Mencari berdasarkan purchase_invoice_id (lebih akurat) atau pola deskripsi lama
      const selectedClient = clients.find(c => c.id === clientId)
      const { data: expense } = await supabase
        .from('expenses')
        .select('id')
        .or(`purchase_invoice_id.eq.${invoice.id},description.ilike.%Belanja ${invoice.invoice_number}%`)
        .maybeSingle()

      if (expense) {
        await supabase.from('expenses').update({
          date: invoiceDate,
          amount: status === 'cancelled' ? 0 : totalAmount,
          client_id: clientId,
          description: `Otomatis: Belanja ${invoiceNumber} (${selectedClient?.name || 'Internal'})`,
          purchase_invoice_id: invoice.id
        }).eq('id', expense.id)
      } else if (status !== 'cancelled') {
        // Jika data expense hilang/tidak ketemu, buat baru
        await supabase.from('expenses').insert({
          user_id: user.id,
          amount: totalAmount,
          date: invoiceDate,
          category: 'Belanja Stok',
          description: `Otomatis: Belanja ${invoiceNumber} (${selectedClient?.name || 'Internal'})`,
          client_id: clientId,
          purchase_invoice_id: invoice.id
        })
      }

      toast.success("Perubahan disimpan dan pengeluaran diperbarui")
      onSuccess()
      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui data")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Edit Invoice Pemakaian</DialogTitle>
            <DialogDescription>
              Mengubah data di sini akan otomatis menyesuaikan stok gudang dan laporan pengeluaran.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit Pemakai</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>No. Referensi</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="used">Digunakan (Potong Stok)</SelectItem>
                  <SelectItem value="cancelled">Dibatalkan (Kembalikan Stok)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
               <h3 className="text-xs font-bold text-muted-foreground uppercase">Daftar Barang</h3>
               <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])}>
                <Plus className="h-4 w-4 mr-1" /> Tambah Item
              </Button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="p-4 rounded-lg border bg-slate-50/30 space-y-3">
                <div className="flex justify-between items-center">
                   <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className={cn("h-7 text-[10px] font-bold", item.isCustom ? "text-orange-600" : "text-blue-600")}
                    onClick={() => {
                      const newItems = [...items]
                      newItems[index].isCustom = !newItems[index].isCustom
                      newItems[index].inventoryId = undefined
                      setItems(newItems)
                    }}
                  >
                    {item.isCustom ? <Keyboard className="h-3 w-3 mr-1" /> : <Package className="h-3 w-3 mr-1" />}
                    {item.isCustom ? "CUSTOM ITEM" : "STOK GUDANG"}
                  </Button>
                  {items.length > 1 && <Trash2 className="h-4 w-4 text-destructive cursor-pointer hover:scale-110" onClick={() => setItems(items.filter((_, i) => i !== index))} />}
                </div>

                {!item.isCustom ? (
                  <Select value={item.inventoryId} onValueChange={(v) => handleUpdateItem(index, 'inventoryId', v)}>
                    <SelectTrigger><SelectValue placeholder="Pilih barang..." /></SelectTrigger>
                    <SelectContent>
                      {inventory.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.name} (Stok: {inv.quantity})</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={item.description} placeholder="Keterangan barang..." onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} />
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Qty</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Harga</Label>
                    <Input type="number" value={item.unitPrice} onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px]">Subtotal</Label>
                    <div className="h-10 flex items-center justify-end px-3 bg-muted rounded-md font-mono text-xs font-bold">{formatCurrency(item.quantity * item.unitPrice)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-slate-900 text-white flex justify-between items-center shadow-lg">
            <span className="font-bold">Total Nilai Baru</span>
            <span className="text-xl font-black">{formatCurrency(totalAmount)}</span>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full h-12 font-bold" disabled={isLoading}>
              {isLoading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Memproses...</> : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}