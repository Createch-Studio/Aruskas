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

interface AddReceivableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddReceivableDialog({ open, onOpenChange, onSuccess }: AddReceivableDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [debtorName, setDebtorName] = useState('')
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

    const { error } = await supabase.from('receivables').insert({
      user_id: user.id,
      client_id: null,
      name: debtorName,
      description: description || null,
      amount: amount,
      remaining_amount: amount,
      due_date: dueDate || null,
      status: 'active',
    })

    setIsLoading(false)

    if (!error) {
      onOpenChange(false)
      setDebtorName('')
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
          <DialogTitle>Tambah Piutang</DialogTitle>
          <DialogDescription>
            Catat piutang baru yang perlu ditagih
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="debtor-name">Nama Debitur</Label>
            <Input
              id="debtor-name"
              value={debtorName}
              onChange={(e) => setDebtorName(e.target.value)}
              placeholder="Nama orang/perusahaan yang berhutang"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="total-amount">Total Piutang</Label>
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
              placeholder="Keterangan tentang piutang ini"
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
