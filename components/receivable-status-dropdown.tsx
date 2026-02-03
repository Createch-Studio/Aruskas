'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client' // Pastikan path ini benar
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
import type { Receivable } from '@/lib/types'

interface ReceivableStatusDropdownProps {
  receivable: Receivable
  onRefresh: () => void
}

export function ReceivableStatusDropdown({ receivable, onRefresh }: ReceivableStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const supabase = createClient()

  const handleUpdatePayment = async () => {
    const amountNum = parseFloat(paymentAmount)
    if (!paymentAmount || amountNum <= 0) {
      alert('Masukkan jumlah pembayaran yang valid')
      return
    }

    setIsLoading(true)
    try {
      // 1. Insert ke tabel riwayat pembayaran
      const { error: payError } = await supabase
        .from('receivable_payments')
        .insert({
          receivable_id: receivable.id,
          amount: amountNum,
          notes: notes || 'Penerimaan cicilan',
          payment_date: new Date().toISOString()
        })

      if (payError) throw payError

      // 2. Update tabel utama (Sisa & Status)
      const newRemaining = Math.max(0, receivable.remaining_amount - amountNum)
      const { error: updateError } = await supabase
        .from('receivables')
        .update({
          remaining_amount: newRemaining,
          status: newRemaining === 0 ? 'paid' : 'partial'
        })
        .eq('id', receivable.id)

      if (updateError) throw updateError

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
    if (!confirm('Tandai piutang ini sebagai lunas?')) return
    
    setIsLoading(true)
    try {
      // Catat pelunasan
      await supabase.from('receivable_payments').insert({
        receivable_id: receivable.id,
        amount: receivable.remaining_amount,
        notes: 'Pelunasan otomatis',
        payment_date: new Date().toISOString()
      })

      const { error } = await supabase
        .from('receivables')
        .update({ remaining_amount: 0, status: 'paid' })
        .eq('id', receivable.id)

      if (error) throw error
      onRefresh()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus piutang ini?')) return

    setIsLoading(true)
    try {
      // Hapus data (Relasi di DB harus ON DELETE CASCADE agar riwayat ikut terhapus)
      const { error } = await supabase
        .from('receivables')
        .delete()
        .eq('id', receivable.id)

      if (error) throw error
      onRefresh()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // --- UI Logic (Status Badge) tetap sama ---
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' }> = {
      active: { label: 'Aktif', variant: 'default' },
      partial: { label: 'Sebagian', variant: 'secondary' },
      paid: { label: 'Lunas', variant: 'default' },
      overdue: { label: 'Jatuh Tempo', variant: 'destructive' },
    }
    return variants[status] || { label: status, variant: 'default' }
  }

  const badge = getStatusBadge(receivable.status)

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
            Update Penerimaan
          </DropdownMenuItem>
          {receivable.status !== 'paid' && (
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
            <DialogTitle>Update Penerimaan</DialogTitle>
            <DialogDescription>
              Sisa: Rp {receivable.remaining_amount.toLocaleString('id-ID')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Jumlah Penerimaan</Label>
              <Input
                id="payment-amount"
                type="number"
                placeholder="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Catatan</Label>
              <Input
                id="payment-notes"
                placeholder="Catatan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdatePayment} disabled={isLoading}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}