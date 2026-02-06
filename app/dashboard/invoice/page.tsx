'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AddInvoiceDialog } from '@/components/add-invoice-dialog'
import { InvoiceTable } from '@/components/invoice-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Receipt, Clock, CheckCircle2 } from 'lucide-react'
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

  // Helper format mata uang tanpa desimal
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

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
        .gte('invoice_date', start)
        .lte('invoice_date', end)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
    ])

    if (invoicesRes.data) {
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Belanja</h1>
          <p className="text-muted-foreground">
            Pantau pengeluaran bahan baku untuk setiap pesanan.
          </p>
        </div>
        <AddInvoiceDialog clients={clients} onSuccess={fetchData} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoice</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nilai</CardTitle>
            <span className="text-xs font-bold text-blue-500">IDR</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalAmount)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Digunakan</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingInvoices}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sudah Digunakan</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{usedInvoices}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Tabs value={period} onValueChange={(val) => setPeriod(val as PeriodType)} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="daily">Harian</TabsTrigger>
                <TabsTrigger value="monthly">Bulanan</TabsTrigger>
                <TabsTrigger value="yearly">Tahunan</TabsTrigger>
                <TabsTrigger value="all">Semua</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md px-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {period === 'daily' && (
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-none bg-transparent h-8 focus-visible:ring-0 w-[150px]"
                />
              )}
              {period === 'monthly' && (
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border-none bg-transparent h-8 focus-visible:ring-0 w-[150px]"
                />
              )}
              {period === 'yearly' && (
                <Input
                  type="number"
                  min="2000"
                  max="2099"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="border-none bg-transparent h-8 focus-visible:ring-0 w-[80px]"
                />
              )}
              {period === 'all' && <span className="text-sm font-medium px-2">Semua Waktu</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p>Memproses data...</p>
            </div>
          ) : (
            <InvoiceTable invoices={invoices} clients={clients} onRefresh={fetchData} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}