'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AddInvoiceDialog } from '@/components/add-invoice-dialog'
import { InvoiceTable } from '@/components/invoice-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'
import type { PurchaseInvoice, Client } from '@/lib/types'

type PeriodType = 'daily' | 'monthly' | 'yearly' | 'all'

function getDateRange(period: PeriodType, selectedDate?: string, selectedMonth?: string, selectedYear?: string) {
  const now = new Date()
  let startStr: string
  let endStr: string

  const format = (d: Date) => d.toISOString().split('T')[0]

  switch (period) {
    case 'daily': {
      const targetDate = selectedDate ? new Date(selectedDate) : now
      startStr = format(targetDate)
      endStr = format(targetDate)
      break
    }
    case 'monthly': {
      const [year, month] = selectedMonth ? selectedMonth.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1]
      startStr = format(new Date(year, month - 1, 1))
      endStr = format(new Date(year, month, 0))
      break
    }
    case 'yearly': {
      const year = selectedYear ? parseInt(selectedYear) : now.getFullYear()
      startStr = `${year}-01-01`
      endStr = `${year}-12-31`
      break
    }
    default:
      startStr = '2000-01-01'
      endStr = '2099-12-31'
      break
  }

  return { start: startStr, end: endStr }
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))

const fetchData = useCallback(async () => {
  setLoading(true)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    setLoading(false)
    return
  }

  const { start, end } = getDateRange(period, selectedDate, selectedMonth, selectedYear)

  const [invoicesRes, clientsRes] = await Promise.all([
    supabase
      .from('purchase_invoices')
      .select('*, clients(*), purchase_invoice_items(*)')
      .eq('user_id', user.id)
      .gte('invoice_date', start) // String YYYY-MM-DD
      .lte('invoice_date', end)   // String YYYY-MM-DD
      .order('invoice_date', { ascending: false }),
    supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
  ])

  if (invoicesRes.error) {
    console.error('Error fetching invoices:', invoicesRes.error.message)
  }

  if (invoicesRes.data) {
    // Memastikan mapping data benar
    const formattedInvoices = invoicesRes.data.map(inv => ({
      ...inv,
      client: inv.clients,
      items: inv.purchase_invoice_items || []
    }))
    setInvoices(formattedInvoices as PurchaseInvoice[])
  }
  
  if (clientsRes.data) setClients(clientsRes.data as Client[])
  setLoading(false)
}, [period, selectedDate, selectedMonth, selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalInvoices = invoices.length
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0)
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length
  const usedInvoices = invoices.filter(inv => inv.status === 'used').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice Belanja Pesanan</h1>
          <p className="text-muted-foreground">
            Kelola invoice belanja bahan baku untuk pesanan client
          </p>
        </div>
        <AddInvoiceDialog clients={clients} onSuccess={fetchData} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nilai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalAmount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Digunakan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sudah Digunakan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{usedInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Invoice</CardTitle>
          <CardDescription>Filter invoice berdasarkan periode</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={period} onValueChange={(val) => setPeriod(val as PeriodType)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="daily">Harian</TabsTrigger>
              <TabsTrigger value="monthly">Bulanan</TabsTrigger>
              <TabsTrigger value="yearly">Tahunan</TabsTrigger>
              <TabsTrigger value="all">Semua</TabsTrigger>
            </TabsList>

            <TabsContent value={period} className="space-y-4">
              {period === 'daily' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="invoice-date" className="sr-only">Pilih Tanggal</Label>
                  <Input
                    id="invoice-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
              )}

              {period === 'monthly' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="invoice-month" className="sr-only">Pilih Bulan</Label>
                  <Input
                    id="invoice-month"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-auto"
                  />
                </div>
              )}

              {period === 'yearly' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="invoice-year" className="sr-only">Pilih Tahun</Label>
                  <Input
                    id="invoice-year"
                    type="number"
                    min="2000"
                    max="2099"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-auto"
                  />
                </div>
              )}

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : (
                <InvoiceTable invoices={invoices} clients={clients} onRefresh={fetchData} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
