'use client'

import React from "react"

import { useState, useEffect } from 'react'
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
import type { Cash, CashTransaction } from '@/lib/types'

interface EditCashTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: CashTransaction | null
  cashAccounts: Cash[]
  onSuccess: () => void
}

export function EditCashTransactionDialog({
  open,
  onOpenChange,
  transaction,
  cashAccounts,
  onSuccess,
}: EditCashTransactionDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [cashId, setCashId] = useState('')
  const [type, setType] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (transaction) {
      setCashId(transaction.cash_id)
      setType(transaction.type)
      setAmount(transaction.amount.toString())
      setDescription(transaction.description || '')
      setTransactionDate(transaction.transaction_date.split('T')[0])
    }
  }, [transaction])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction) return

    setIsLoading(true)

    try {
      const supabase = createClient()
      
      const amountValue = parseFloat(amount)
      if (!amountValue || amountValue <= 0) {
        alert('Jumlah harus lebih dari 0')
        setIsLoading(false)
        return
      }

      // Calculate difference in amounts
      const oldAmount = transaction.amount
      const amountDiff = amountValue - oldAmount

      // Update transaction
      const { error: transactionError } = await supabase
        .from('cash_transactions')
        .update({
          cash_id: cashId,
          type,
          amount: amountValue,
          description: description || null,
          transaction_date: transactionDate,
        })
        .eq('id', transaction.id)

      if (transactionError) {
        alert('Gagal memperbarui transaksi: ' + transactionError.message)
        setIsLoading(false)
        return
      }

      // Update cash balances if cash account or type changed
      if (cashId !== transaction.cash_id || type !== transaction.type) {
        // Revert old transaction
        const oldAccount = cashAccounts.find(acc => acc.id === transaction.cash_id)
        if (oldAccount) {
          const revertAmount = transaction.type === 'in' 
            ? oldAccount.amount - transaction.amount
            : oldAccount.amount + transaction.amount

          await supabase
            .from('cash')
            .update({ amount: revertAmount })
            .eq('id', transaction.cash_id)
        }

        // Apply new transaction
        const newAccount = cashAccounts.find(acc => acc.id === cashId)
        if (newAccount) {
          const newAmount = type === 'in' 
            ? newAccount.amount + amountValue
            : newAccount.amount - amountValue

          await supabase
            .from('cash')
            .update({ amount: newAmount })
            .eq('id', cashId)
        }
      } else if (amountDiff !== 0) {
        // Only amount changed, update same account
        const account = cashAccounts.find(acc => acc.id === cashId)
        if (account) {
          const adjustment = type === 'in' ? amountDiff : -amountDiff
          await supabase
            .from('cash')
            .update({ amount: account.amount + adjustment })
            .eq('id', cashId)
        }
      }

      onOpenChange(false)
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
          <DialogTitle>Edit Transaksi Kas</DialogTitle>
          <DialogDescription>
            Perbarui detail transaksi kas
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-cash-account">Akun Kas</Label>
            <Select value={cashId} onValueChange={setCashId} required>
              <SelectTrigger id="edit-cash-account">
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
            <Label htmlFor="edit-type">Tipe Transaksi</Label>
            <Select value={type} onValueChange={(val) => setType(val as 'in' | 'out')} required>
              <SelectTrigger id="edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Pemasukan</SelectItem>
                <SelectItem value="out">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-amount">Jumlah</Label>
            <Input
              id="edit-amount"
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
            <Label htmlFor="edit-transaction-date">Tanggal</Label>
            <Input
              id="edit-transaction-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-description">Deskripsi (opsional)</Label>
            <Textarea
              id="edit-description"
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
