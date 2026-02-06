'use client'

import React, { useState } from "react"
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { Client } from '@/lib/types'

interface InvoiceItemInput {
  description: string
  quantity: number
  unitPrice: number
}

interface AddInvoiceDialogProps {
  clients: Client[]
  onSuccess: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function AddInvoiceDialog({ clients, onSuccess }: AddInvoiceDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { description: '', quantity: 1, unitPrice: 0 }
  ])
  const router = useRouter()

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof InvoiceItemInput, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setIsLoading(false)
      return
    }

    const validItems = items.filter(item => item.description.trim() && item.unitPrice > 0)
    if (validItems.length === 0 || !clientId) {
      setIsLoading(false)
      return
    }

    const totalAmount = calculateTotal()
    const selectedClient = clients.find(c => c.id === clientId)

    try {
      // 1. Simpan Invoice Utama ke purchase_invoices
      const { data: invoice, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          description: description || null,
          total_amount: totalAmount,
          invoice_date: invoiceDate,
          status: 'pending',
        })
        .select()
        .single()

      if (invoiceError || !invoice) throw invoiceError

      // 2. Simpan Detail Item ke purchase_invoice_items
      const invoiceItems = validItems.map((item) => ({
        purchase_invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }))
      await supabase.from('purchase_invoice_items').insert(invoiceItems)

      // 3. INTEGRASI OTOMATIS KE PENGELUARAN (EXPENSES)
      // Cari kategori "Invoice Belanja"
      let { data: category } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Invoice Belanja')
        .maybeSingle()

      // Jika kategori belum ada, buat otomatis
      if (!category) {
        const { data: newCat, error: catError } = await supabase
          .from('expense_categories')
          .insert({ name: 'Invoice Belanja', user_id: user.id })
          .select()
          .single()
        if (catError) console.error("Gagal buat kategori:", catError)
        category = newCat
      }

      // Masukkan transaksi ke tabel expenses
      if (category) {
        const { error: expError } = await supabase.from('expenses').insert({
          user_id: user.id,
          date: invoiceDate,
          amount: totalAmount,
          category_id: category.id,
          client_id: clientId,
          description: `Otomatis: Belanja ${invoiceNumber} (${selectedClient?.name || 'Client'})`,
        })
        if (expError) console.error("Gagal sinkron pengeluaran:", expError)
      }

      // Reset State & Close Dialog
      setOpen(false)
      setClientId('')
      setClientSearch('')
      setInvoiceNumber('')
      setDescription('')
      setInvoiceDate(new Date().toISOString().split('T')[0])
      setItems([{ description: '', quantity: 1, unitPrice: 0 }])
      
      onSuccess()
      router.refresh()
    } catch (error) {
      console.error("Terjadi kesalahan:", error)
      alert("Gagal menyimpan invoice. Silakan coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah Invoice Belanja</DialogTitle>
            <DialogDescription>
              Invoice ini akan otomatis dicatat sebagai pengeluaran bisnis.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Row 1: Client & Invoice Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="client">Client</Label>
                <Select value={clientId} onValueChange={setClientId} required>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Pilih client" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="Cari client..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        Tidak ada client ditemukan
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invoice-number">Nomor Invoice</Label>
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV/2024/001"
                  required
                />
              </div>
            </div>

            {/* Row 2: Date & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invoice-date">Tanggal Belanja</Label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Catatan Tambahan</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Belanja di Toko ABC"
                />
              </div>
            </div>

            {/* Item List Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Daftar Item / Bahan Baku</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Baris
                </Button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="rounded-lg border bg-card p-3 shadow-sm space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Nama bahan baku (cth: Tepung Terigu)"
                      className="flex-1"
                    />
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Jumlah</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Harga Satuan</Label>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subtotal</Label>
                      <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Total */}
            <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-muted-foreground">Total Keseluruhan</p>
                <p className="text-xs text-muted-foreground italic">*Otomatis masuk ke laporan pengeluaran</p>
              </div>
              <span className="text-xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" className="min-w-[120px]" disabled={isLoading || !clientId || !invoiceNumber}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Proses...
                </span>
              ) : 'Simpan Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}