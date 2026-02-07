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
import { Badge } from '@/components/ui/badge' 
import { Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react'
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

  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [status, setStatus] = useState<'pending' | 'used' | 'cancelled'>('pending')
  const [items, setItems] = useState<InvoiceItemInput[]>([])

  const isOldTypeIn = invoice?.description?.toLowerCase().includes('pembelian') || false

  useEffect(() => {
    setIsMounted(true)
    if (open) fetchInventory()
    if (invoice && open) {
      setClientId(invoice.client_id)
      setInvoiceNumber(invoice.invoice_number)
      setDescription(invoice.description || '')
      setInvoiceDate(invoice.invoice_date ? invoice.invoice_date.split('T')[0] : '')
      setStatus(invoice.status as any)
      setItems(
        invoice.items?.map(item => ({
          id: item.id,
          inventoryId: item.inventory_id || undefined,
          description: item.description,
          quantity: item.quantity,
          // PERBAIKAN: Memetakan unit_price dari DB ke unitPrice di state
          unitPrice: item.unit_price || 0, 
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

  if (!isMounted) return null

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
    if (!invoice || isLoading) return
    setIsLoading(true)

    try {
      if (invoice.items && invoice.status !== 'cancelled') {
        for (const oldItem of invoice.items) {
          if (oldItem.inventory_id) {
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', oldItem.inventory_id).single()
            if (inv) {
              const revertedQty = isOldTypeIn 
                ? inv.quantity - oldItem.quantity  
                : inv.quantity + oldItem.quantity  
              await supabase.from('inventory').update({ quantity: revertedQty }).eq('id', oldItem.inventory_id)
            }
          }
        }
      }

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

      if (status !== 'cancelled') {
        for (const item of items) {
          if (!item.isCustom && item.inventoryId) {
            const { data: inv } = await supabase.from('inventory').select('quantity').eq('id', item.inventoryId).single()
            if (inv) {
              const newQty = isOldTypeIn 
                ? inv.quantity + item.quantity 
                : inv.quantity - item.quantity 
              await supabase.from('inventory').update({ quantity: newQty }).eq('id', item.inventoryId)
            }
          }
        }
      }

      await supabase.from('expenses').update({
        date: invoiceDate,
        amount: status === 'cancelled' ? 0 : totalAmount,
        client_id: clientId,
        description: `Otomatis: ${isOldTypeIn ? 'Pembelian' : 'Pemakaian'} ${invoiceNumber}`,
      }).eq('purchase_invoice_id', invoice.id)

      toast.success("Perubahan berhasil disimpan")
      onSuccess()
      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      toast.error("Gagal update: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none shadow-2xl p-0">
        <form onSubmit={handleSubmit}>
          <div className={cn(
            "p-6 text-white",
            isOldTypeIn ? "bg-emerald-600" : "bg-slate-900"
          )}>
            <div className="flex justify-between items-start">
              <div>
                <Badge className="bg-white/20 border-none text-white mb-2 uppercase text-[10px]">
                   {isOldTypeIn ? 'Barang Masuk' : 'Barang Keluar'}
                </Badge>
                <DialogTitle className="text-2xl font-bold">Edit Transaksi</DialogTitle>
                <DialogDescription className="text-white/70">No. Ref: {invoice?.invoice_number}</DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Pihak Terkait</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">No. Referensi</Label>
                <Input className="bg-slate-50" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Tanggal</Label>
                <Input className="bg-slate-50" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Status Transaksi</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className={cn(
                    "bg-slate-50",
                    status === 'pending' && "text-amber-600",
                    status === 'used' && "text-emerald-600",
                    status === 'cancelled' && "text-red-600"
                  )}>
                      <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="used">Selesai (Used)</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {status === 'cancelled' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 font-medium">
                      Status Dibatalkan akan mengembalikan stok gudang ke posisi semula.
                  </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daftar Barang</h3>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-blue-600" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0, isCustom: false }])}>
                      + Tambah Baris
                  </Button>
              </div>
              
              {items.map((item, index) => (
                <div key={index} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 space-y-3 relative">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-[9px] uppercase cursor-pointer" onClick={() => {
                      const newItems = [...items]
                      newItems[index].isCustom = !newItems[index].isCustom
                      newItems[index].inventoryId = undefined
                      setItems(newItems)
                    }}>
                      {item.isCustom ? "Kustom" : "Gudang"}
                    </Badge>
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4 text-slate-300 hover:text-red-500" />
                      </button>
                    )}
                  </div>

                  {!item.isCustom ? (
                    <Select value={item.inventoryId} onValueChange={(v) => handleUpdateItem(index, 'inventoryId', v)}>
                      <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="Pilih barang..." /></SelectTrigger>
                      <SelectContent>
                        {inventory.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.name} (Stok: {inv.quantity})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="bg-white h-9 text-xs" placeholder="Nama barang..." value={item.description} onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} />
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[9px] uppercase text-slate-400 font-bold">Qty</Label>
                      <Input className="bg-white h-9 text-xs" type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-[9px] uppercase text-slate-400 font-bold">Harga</Label>
                      <Input className="bg-white h-9 text-xs" type="number" value={item.unitPrice} onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="text-right">
                      <Label className="text-[9px] uppercase text-slate-400 font-bold">Subtotal</Label>
                      <div className="h-9 flex items-center justify-end px-3 bg-slate-100 rounded text-[11px] font-bold">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">TOTAL AKHIR</span>
              <span className="text-xl font-black">{formatCurrency(totalAmount)}</span>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full py-6 font-bold" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}