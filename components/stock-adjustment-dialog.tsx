'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { InventoryItem } from '@/lib/types'

interface StockAdjustmentDialogProps {
  item: InventoryItem | null
  type: 'in' | 'out'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function StockAdjustmentDialog({ item, type, open, onOpenChange, onSuccess }: StockAdjustmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0])
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return
    setIsLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const adjustQty = parseFloat(quantity) || 0
    const newQuantity = type === 'in' 
      ? item.quantity + adjustQty 
      : Math.max(0, item.quantity - adjustQty)

    // Update inventory quantity
    await supabase
      .from('inventory')
      .update({ quantity: newQuantity })
      .eq('id', item.id)

    // Record transaction
    await supabase.from('inventory_transactions').insert({
      inventory_id: item.id,
      type,
      quantity: adjustQty,
      notes: notes || null,
      transaction_date: transactionDate,
    })

    // Update corresponding asset value
    const newTotalValue = newQuantity * item.unit_cost
    await supabase
      .from('assets')
      .update({
        current_value: newTotalValue,
        notes: `Dibuat otomatis dari inventaris (${newQuantity} ${item.unit})`
      })
      .eq('user_id', user.id)
      .eq('name', item.name)
      .eq('category', 'Inventaris')

    setIsLoading(false)
    setQuantity('')
    setNotes('')
    setTransactionDate(new Date().toISOString().split('T')[0])
    onOpenChange(false)
    onSuccess()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === 'in' ? 'Stok Masuk' : 'Stok Keluar'} - {item?.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p>Stok saat ini: <span className="font-semibold">{item?.quantity} {item?.unit}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="adjust-qty">Jumlah</Label>
              <Input
                id="adjust-qty"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjust-date">Tanggal</Label>
              <Input
                id="adjust-date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adjust-notes">Catatan (opsional)</Label>
            <Textarea
              id="adjust-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={type === 'in' ? 'Misal: Pembelian dari supplier X' : 'Misal: Digunakan untuk produksi'}
            />
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p>Stok setelah: <span className="font-semibold">
              {type === 'in' 
                ? (item?.quantity || 0) + (parseFloat(quantity) || 0)
                : Math.max(0, (item?.quantity || 0) - (parseFloat(quantity) || 0))
              } {item?.unit}
            </span></p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
