'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Cash } from '@/lib/types'

interface EditCashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cash: Cash | null
  onSuccess: () => void
}

export function EditCashDialog({ open, onOpenChange, cash, onSuccess }: EditCashDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<'cash' | 'bank' | 'e-wallet'>('cash')
  const [description, setDescription] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (cash) {
      setAccountName(cash.name)
      setAccountType(cash.account_type)
      setDescription(cash.description || '')
    }
  }, [cash])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cash) return

    setIsLoading(true)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('cash')
        .update({
          name: accountName,
          account_type: accountType,
          description: description || null,
        })
        .eq('id', cash.id)

      if (error) {
        alert('Gagal mengupdate akun kas: ' + error.message)
        setIsLoading(false)
        return
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Akun Kas</DialogTitle>
          <DialogDescription>
            Ubah informasi akun kas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="account-name">Nama Akun</Label>
            <Input
              id="account-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Contoh: Kas Toko, BCA, GoPay"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account-type">Tipe Akun</Label>
            <Select value={accountType} onValueChange={(value: any) => setAccountType(value)}>
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Tunai</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="e-wallet">E-Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Saldo Saat Ini</Label>
            <div className="text-lg font-semibold">
              {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(cash?.amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Saldo tidak bisa diubah langsung. Gunakan transaksi untuk mengubah saldo.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Keterangan (Opsional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tambahkan keterangan jika diperlukan"
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
