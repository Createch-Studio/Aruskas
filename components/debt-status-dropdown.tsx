'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client' // Pastikan file client supabase Anda sudah benar
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MoreVertical } from 'lucide-react'
import type { Debt } from '@/lib/types'

interface DebtStatusDropdownProps {
  debt: Debt
  onRefresh: () => void
}

export function DebtStatusDropdown({ debt, onRefresh }: DebtStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createClient()

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      active: { label: 'Aktif', variant: 'default' },
      partial: { label: 'Sebagian', variant: 'secondary' },
      paid: { label: 'Lunas', variant: 'default' },
      overdue: { label: 'Jatuh Tempo', variant: 'destructive' },
    }
    return variants[status] || { label: status, variant: 'default' }
  }

  const handleUpdatePayment = async () => {
    const amountNum = parseFloat(paymentAmount)
    if (!paymentAmount || amountNum <= 0) {
      alert('Masukkan jumlah pembayaran yang valid')
      return
    }

    setIsLoading(true)
    try {
      // Direct Query: Insert ke tabel riwayat pembayaran
      // Trigger SQL akan otomatis mengurangi remaining_amount di tabel debts
      const { error } = await supabase
        .from('debt_payments')
        .insert({
          debt_id: debt.id,
          amount: amountNum,
          notes: notes || 'Pembayaran cicilan',
          payment_date: new Date().toISOString()
        })

      if (error) throw error

      setPaymentDialogOpen(false)
      setPaymentAmount('')
      setNotes('')
      onRefresh()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!confirm('Tandai utang ini sebagai lunas?')) return

    setIsLoading(true)
    try {
      // Direct Query: Catat pembayaran sejumlah sisa utang
      const { error: payError } = await supabase
        .from('debt_payments')
        .insert({
          debt_id: debt.id,
          amount: debt.remaining_amount,
          notes: 'Pelunasan (Tandai Lunas)',
          payment_date: new Date().toISOString()
        })

      if (payError) throw payError

      onRefresh()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus utang ini?')) return

    setIsLoading(true)
    try {
      // Hapus utang secara langsung
      // Pastikan di DB diset "ON DELETE CASCADE" untuk debt_payments
      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', debt.id)

      if (error) throw error
      onRefresh()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const badge = getStatusBadge(debt.status)

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setPaymentDialogOpen(true)}>
            Update Pembayaran
          </DropdownMenuItem>
          {debt.status !== 'paid' && (
            <DropdownMenuItem onClick={handleMarkPaid}>
              Tandai Lunas
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Badge variant={badge.variant as any}>{badge.label}</Badge>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Pembayaran</DialogTitle>
            <DialogDescription>
              Sisa Utang: Rp {debt.remaining_amount.toLocaleString('id-ID')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Jumlah Pembayaran</Label>
              <Input
                id="payment-amount"
                type="number"
                placeholder="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Catatan (Opsional)</Label>
              <Input
                id="payment-notes"
                placeholder="Catatan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdatePayment} disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}