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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AddCashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddCashDialog({ open, onOpenChange, onSuccess }: AddCashDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<'cash' | 'bank' | 'e-wallet'>('cash')
  const [balance, setBalance] = useState('')
  const [description, setDescription] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        console.log('[v0] No user found')
        alert('Anda harus login terlebih dahulu')
        setIsLoading(false)
        return
      }

      console.log('[v0] Inserting cash account:', { accountName, accountType, balance })

      const { data, error } = await supabase.from('cash').insert({
        user_id: user.id,
        name: accountName,
        account_type: accountType,
        amount: parseFloat(balance) || 0,
        description: description || null,
      }).select()

      if (error) {
        console.log('[v0] Error inserting cash:', error)
        alert('Gagal menambahkan akun kas: ' + error.message)
        setIsLoading(false)
        return
      }

      console.log('[v0] Cash account created successfully:', data)

      onOpenChange(false)
      setAccountName('')
      setAccountType('cash')
      setBalance('')
      setDescription('')
      onSuccess()
      router.refresh()
    } catch (err) {
      console.log('[v0] Unexpected error:', err)
      alert('Terjadi kesalahan: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Akun Kas</DialogTitle>
          <DialogDescription>
            Tambahkan akun kas, bank, atau e-wallet baru
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
            <Label htmlFor="balance">Saldo Awal</Label>
            <Input
              id="balance"
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
              required
            />
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
