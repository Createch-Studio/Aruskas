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
import { Plus, Trash2, Package, Keyboard, Loader2, AlertTriangle } from 'lucide-react'
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

  const [isLoading, setIsLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [status, setStatus] = useState<'pending' | 'used' | 'cancelled'>('pending')
  const [items, setItems] = useState<InvoiceItemInput[]>([])

  // Deteksi tipe invoice lama berdasarkan deskripsi (atau kolom khusus jika ada)
  const isOldTypeIn = invoice?.description?.toLowerCase().includes('pembelian') || false

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
      // 1. REVERT STOK LAMA
      // Jika dulu 'Masuk', maka sekarang kurangi. Jika dulu 'Keluar', maka sekarang tambah.
      if (invoice.items && invoice.status !== 'cancelled') {
        for (const oldItem of invoice.items) {
          if (oldItem.inventory_id) {
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', oldItem.inventory_id).single()
            if (inv) {
              const revertedQty = isOldTypeIn 
                ? inv.quantity - oldItem.quantity  // Balikin: hapus tambahan yang dulu
                : inv.quantity + oldItem.quantity  // Balikin: balikin barang yang dulu dipotong
              
              await supabase.from('inventory').update({ quantity: revertedQty }).eq('id', oldItem.inventory_id)
            }
          }
        }
      }

      // 2. UPDATE INVOICE
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

      // 3. SYNC ITEMS
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

      // 4. TERAPKAN STOK BARU (Hanya jika status bukan 'cancelled')
      if (status !== 'cancelled') {
        for (const item of items) {
          if (!item.isCustom && item.inventoryId) {
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', item.inventoryId).single()
            if (inv) {
              // Gunakan logika tipe yang sama dengan deskripsi invoice
              const newQty = isOldTypeIn 
                ? inv.quantity + item.quantity // Tipe Masuk (Beli)
                : inv.quantity - item.quantity // Tipe Keluar (Pakai)
              
              await supabase.from('inventory').update({ quantity: newQty }).eq('id', item.inventoryId)
            }
          }
        }
      }

      // 5. SYNC EXPENSES
      await supabase.from('expenses').update({
        date: invoiceDate,
        amount: status === 'cancelled' ? 0 : totalAmount,
        client_id: clientId,
        description: `Otomatis: ${isOldTypeIn ? 'Pembelian' : 'Pemakaian'} ${invoiceNumber} (${clients.find(c => c.id === clientId)?.name})`,
      }).eq('purchase_invoice_id', invoice.id)

      toast.success("Data berhasil diperbarui")
      onSuccess()
      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    isOldTypeIn ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                )}>
                    {isOldTypeIn ? 'Invoice Pembelian (Masuk)' : 'Invoice Pemakaian (Keluar)'}
                </span>
            </div>
            <DialogTitle>Edit Transaksi Stok</DialogTitle>
            <DialogDescription>Pastikan perubahan jumlah barang sudah sesuai dengan kondisi fisik gudang.</DialogDescription>
          </DialogHeader>

          {/* Form fields sama seperti sebelumnya namun dengan styling yang konsisten */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit/Pihak Terkait</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>No. Referensi</Label>
              <Input className="bg-white" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input className="bg-white" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status Transaksi</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className={cn("bg-white", status === 'cancelled' && "border-destructive text-destructive")}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="used">Selesai / Digunakan</SelectItem>
                  <SelectItem value="cancelled" className="text-destructive font-bold">Dibatalkan (Revert Stok)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === 'cancelled' && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive leading-relaxed">
                      <strong>Perhatian:</strong> Mengubah status ke "Dibatalkan" akan mengembalikan stok ke kondisi sebelum transaksi ini dibuat dan mengenolkan nilai pengeluaran.
                  </p>
              </div>
          )}

          <div className="space-y-4">
             <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Detail Item</h3>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])}>
                    <Plus className="h-3 w-3 mr-1" /> Tambah Baris
                </Button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="p-4 rounded-xl border bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-center">
                   <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    className={cn("h-6 text-[9px] font-bold uppercase", item.isCustom ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}
                    onClick={() => {
                      const newItems = [...items]
                      newItems[index].isCustom = !newItems[index].isCustom
                      newItems[index].inventoryId = undefined
                      setItems(newItems)
                    }}
                  >
                    {item.isCustom ? "Kustom" : "Gudang"}
                  </Button>
                  {items.length > 1 && <Trash2 className="h-4 w-4 text-destructive cursor-pointer" onClick={() => setItems(items.filter((_, i) => i !== index))} />}
                </div>

                {!item.isCustom ? (
                  <Select value={item.inventoryId} onValueChange={(v) => handleUpdateItem(index, 'inventoryId', v)}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {inventory.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.name} (Stok: {inv.quantity})</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className="bg-white" value={item.description} onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} />
                )}

                <div className="grid grid-cols-3 gap-3">
                  <Input className="bg-white text-center" type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                  <Input className="bg-white text-right" type="number" value={item.unitPrice} onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                  <div className="h-10 flex items-center px-3 bg-slate-200 rounded-md font-mono text-xs font-bold">{formatCurrency(item.quantity * item.unitPrice)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-lg">
            <span className="text-sm opacity-70">Total Nilai Baru</span>
            <span className="text-2xl font-black">{formatCurrency(totalAmount)}</span>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full py-7 text-lg font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Simpan & Sinkronkan Stok"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}