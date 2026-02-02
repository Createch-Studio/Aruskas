'use client'

import React from "react"

import { useState, useEffect } from 'react'
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

interface EditInventoryDialogProps {
  item: InventoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditInventoryDialog({ item, open, onOpenChange, onSuccess }: EditInventoryDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (item) {
      setName(item.name)
      setDescription(item.description || '')
      setUnit(item.unit)
      setMinQuantity(item.min_quantity.toString())
      setUnitPrice(item.unit_cost.toString())
    }
  }, [item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return
    setIsLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('inventory')
      .update({
        name,
        description: description || null,
        unit,
        min_quantity: parseFloat(minQuantity) || 0,
        unit_cost: parseFloat(unitPrice) || 0,
      })
      .eq('id', item.id)

    if (!error) {
      // Update corresponding asset
      const newTotalValue = item.quantity * (parseFloat(unitPrice) || 0)
      await supabase
        .from('assets')
        .update({
          name,
          description: description || null,
          purchase_price: newTotalValue,
          current_value: newTotalValue,
          notes: `Dibuat otomatis dari inventaris (${item.quantity} ${unit})`
        })
        .eq('user_id', user.id)
        .eq('name', item.name)
        .eq('category', 'Inventaris')
    }

    setIsLoading(false)

    if (!error) {
      onOpenChange(false)
      onSuccess()
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Barang Inventaris</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nama Barang</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Deskripsi (opsional)</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-unit">Satuan</Label>
              <Input
                id="edit-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-unit-price">Harga Satuan</Label>
              <Input
                id="edit-unit-price"
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                min="0"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-min-quantity">Stok Minimum</Label>
            <Input
              id="edit-min-quantity"
              type="number"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              min="0"
            />
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
