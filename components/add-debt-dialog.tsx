'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface AddDebtDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddDebtDialog({ open, onOpenChange, onSuccess }: AddDebtDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [creditorName, setCreditorName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const amount = parseFloat(totalAmount) || 0

    const { error } = await supabase.from('debts').insert({
      user_id: user.id,
      client_id: null,
      name: creditorName,
      description: description || null,
      amount: amount,
      remaining_amount: amount,
      due_date: dueDate || null,
      status: 'active',
    })

    setIsLoading(false)

    if (!error) {
      onOpenChange(false)
      setCreditorName('')
      setTotalAmount('')
      setDueDate('')
      setDescription('')
      onSuccess()
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Utang</DialogTitle>
          <DialogDescription>
            Catat utang baru yang perlu dibayar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="creditor-name">Nama Kreditur</Label>
            <Input
              id="creditor-name"
              value={creditorName}
              onChange={(e) => setCreditorName(e.target.value)}
              placeholder="Nama orang/perusahaan pemberi pinjaman"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="total-amount">Total Utang</Label>
            <Input
              id="total-amount"
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="due-date">Jatuh Tempo (Opsional)</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Keterangan (Opsional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keterangan tentang utang ini"
              rows={3}
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
