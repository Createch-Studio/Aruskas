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
import { toast } from "sonner" // Opsional: ganti alert dengan toast

interface AddCashTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashAccounts: Cash[]
  onSuccess: () => void
}

// Tambahkan tipe 'transfer'
type TransactionType = 'in' | 'out' | 'transfer'

export function AddCashTransactionDialog({
  open,
  onOpenChange,
  cashAccounts,
  onSuccess,
}: AddCashTransactionDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [cashId, setCashId] = useState('') // Akun Utama / Akun Asal
  const [toCashId, setToCashId] = useState('') // Akun Tujuan (khusus transfer)
  const [type, setType] = useState<TransactionType>('in')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
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

      const amountValue = parseFloat(amount)
      if (!amountValue || amountValue <= 0) {
        alert('Jumlah harus lebih dari 0')
        setIsLoading(false)
        return
      }

      if (type === 'transfer') {
        if (!cashId || !toCashId) {
          alert('Pilih akun asal dan akun tujuan')
          setIsLoading(false)
          return
        }
        if (cashId === toCashId) {
          alert('Akun asal dan tujuan tidak boleh sama')
          setIsLoading(false)
          return
        }

        // LOGIKA TRANSFER: Dua transaksi & Dua Update saldo
        const fromAccount = cashAccounts.find(a => a.id === cashId)
        const toAccount = cashAccounts.find(a => a.id === toCashId)

        if (!fromAccount || !toAccount) return

        // 1. Catat Pengeluaran di Akun Asal
        await supabase.from('cash_transactions').insert({
          cash_id: cashId,
          type: 'out',
          amount: amountValue,
          category: 'Transfer Keluar',
          description: description || `Transfer ke ${toAccount.name}`,
          transaction_date: transactionDate,
        })

        // 2. Catat Pemasukan di Akun Tujuan
        await supabase.from('cash_transactions').insert({
          cash_id: toCashId,
          type: 'in',
          amount: amountValue,
          category: 'Transfer Masuk',
          description: description || `Transfer dari ${fromAccount.name}`,
          transaction_date: transactionDate,
        })

        // 3. Update Saldo Akun Asal (Kurangi)
        await supabase.from('cash').update({ amount: fromAccount.amount - amountValue }).eq('id', cashId)

        // 4. Update Saldo Akun Tujuan (Tambah)
        await supabase.from('cash').update({ amount: toAccount.amount + amountValue }).eq('id', toCashId)

      } else {
        // LOGIKA BIASA (IN/OUT)
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

        if (transactionError) throw transactionError

        const selectedAccount = cashAccounts.find(acc => acc.id === cashId)
        if (selectedAccount) {
          const newBalance = type === 'in' 
            ? selectedAccount.amount + amountValue
            : selectedAccount.amount - amountValue

          await supabase.from('cash').update({ amount: newBalance }).eq('id', cashId)
        }
      }

      // Reset & Close
      onOpenChange(false)
      setCashId('')
      setToCashId('')
      setType('in')
      setAmount('')
      setDescription('')
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
            Catat pemasukan, pengeluaran, atau transfer antar kas
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid gap-2">
            <Label htmlFor="type">Tipe Transaksi</Label>
            <Select value={type} onValueChange={(val) => setType(val as TransactionType)} required>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Pemasukan</SelectItem>
                <SelectItem value="out">Pengeluaran</SelectItem>
                <SelectItem value="transfer">Transfer Antar Kas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cash-account">
              {type === 'transfer' ? 'Dari Akun (Asal)' : 'Akun Kas'}
            </Label>
            <Select value={cashId} onValueChange={setCashId} required>
              <SelectTrigger id="cash-account">
                <SelectValue placeholder="Pilih akun" />
              </SelectTrigger>
              <SelectContent>
                {cashAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} (Rp {account.amount.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field Tambahan Khusus Transfer */}
          {type === 'transfer' && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="to-cash-account">Ke Akun (Tujuan)</Label>
              <Select value={toCashId} onValueChange={setToCashId} required>
                <SelectTrigger id="to-cash-account">
                  <SelectValue placeholder="Pilih akun tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts
                    .filter(acc => acc.id !== cashId) // Filter agar asal & tujuan tidak sama
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="amount">Jumlah</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
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
            <Label htmlFor="description">Keterangan (opsional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'transfer' ? 'Contoh: Geser saldo operasional' : 'Catatan tambahan'}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isLoading} className={type === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : ''}>
              {isLoading ? 'Memproses...' : type === 'transfer' ? 'Transfer Sekarang' : 'Simpan Transaksi'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}