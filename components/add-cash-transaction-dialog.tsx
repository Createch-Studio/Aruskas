'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { Cash } from '@/lib/types'

interface AddCashTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashAccounts: Cash[]
  onSuccess: () => void
}

export function AddCashTransactionDialog({
  open,
  onOpenChange,
  cashAccounts,
  onSuccess,
}: AddCashTransactionDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [cashId, setCashId] = useState('')
  const [type, setType] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [category, setCategory] = useState('')
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

      if (!cashId) {
        alert('Pilih akun kas terlebih dahulu')
        setIsLoading(false)
        return
      }

      const amountValue = parseFloat(amount)
      if (!amountValue || amountValue <= 0) {
        alert('Jumlah harus lebih dari 0')
        setIsLoading(false)
        return
      }

      // Insert transaction
      const { error: transactionError } = await supabase
        .from('cash_transactions')
        .insert({
          cash_id: cashId,
          type,
          amount: amountValue,
          category: type === 'in' ? 'Pemasukan' : 'Pengeluaran',
          description: description || null,
          transaction_date: transactionDate,
        })

      if (transactionError) {
        alert('Gagal menambahkan transaksi: ' + transactionError.message)
        setIsLoading(false)
        return
      }

      // Update cash balance
      const selectedAccount = cashAccounts.find(acc => acc.id === cashId)
      if (selectedAccount) {
        const newAmount = type === 'in' 
          ? selectedAccount.amount + amountValue
          : selectedAccount.amount - amountValue

        await supabase
          .from('cash')
          .update({ amount: newAmount })
          .eq('id', cashId)
      }

      onOpenChange(false)
      setCashId('')
      setType('in')
      setAmount('')
      setDescription('')
      setTransactionDate(new Date().toISOString().split('T')[0])
      onSuccess()
      router.refresh()
    } catch (err) {
      alert('Terjadi kesalahan: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Transaksi Kas</DialogTitle>
          <DialogDescription>
            Catat pemasukan atau pengeluaran kas
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cash-account">Akun Kas</Label>
            <Select value={cashId} onValueChange={setCashId} required>
              <SelectTrigger id="cash-account">
                <SelectValue placeholder="Pilih akun kas" />
              </SelectTrigger>
              <SelectContent>
                {cashAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Tipe Transaksi</Label>
            <Select value={type} onValueChange={(val) => setType(val as 'in' | 'out')} required>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Pemasukan</SelectItem>
                <SelectItem value="out">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Jumlah</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="transaction-date">Tanggal</Label>
            <Input
              id="transaction-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan tambahan"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
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
