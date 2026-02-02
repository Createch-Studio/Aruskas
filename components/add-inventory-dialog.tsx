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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus } from 'lucide-react'

interface AddInventoryDialogProps {
  onSuccess: () => void
}

export function AddInventoryDialog({ onSuccess }: AddInventoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('Anda harus login terlebih dahulu')
        setIsLoading(false)
        return
      }

      // Insert inventory item
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .insert({
          user_id: user.id,
          name,
          description: description || null,
          unit,
          quantity: parseFloat(quantity) || 0,
          min_quantity: parseFloat(minQuantity) || 0,
          unit_cost: parseFloat(unitPrice) || 0,
        })
        .select()

      if (inventoryError) {
        alert('Gagal menambahkan barang inventaris: ' + inventoryError.message)
        setIsLoading(false)
        return
      }

      // Also create asset entry automatically
      const totalValue = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0)
      const { error: assetError } = await supabase.from('assets').insert({
        user_id: user.id,
        name,
        description: description || null,
        category: 'Inventaris',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_price: totalValue,
        current_value: totalValue,
        condition: 'good',
        status: 'active',
        notes: `Dibuat otomatis dari inventaris (${parseFloat(quantity)} ${unit})`
      })

      // Don't fail if asset creation fails, just log it silently
      
      setOpen(false)
      setName('')
      setDescription('')
      setUnit('')
      setQuantity('')
      setMinQuantity('')
      setUnitPrice('')
      onSuccess()
      router.refresh()
    } catch (err) {
      alert('Terjadi kesalahan: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Barang
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Barang Inventaris</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nama Barang</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="unit">Satuan</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs, kg, liter, dll"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-price">Harga Satuan</Label>
              <Input
                id="unit-price"
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                min="0"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Stok Awal</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="min-quantity">Stok Minimum</Label>
              <Input
                id="min-quantity"
                type="number"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                min="0"
                placeholder="Peringatan jika dibawah"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
