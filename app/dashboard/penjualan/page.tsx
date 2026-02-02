'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from 'lucide-react'
import { SaleTable } from '@/components/sale-table'
import { AddSaleDialog } from '@/components/add-sale-dialog'
import type { Sale, Product, Client, SaleItem, PurchaseInvoice, Order, OrderItem } from '@/lib/types'

type PeriodType = 'daily' | 'monthly' | 'yearly' | 'all'

function getDateRange(period: PeriodType, selectedDate?: string, selectedMonth?: string, selectedYear?: string) {
  const now = new Date()
  let start: Date
  let end: Date

  switch (period) {
    case 'daily': {
      const targetDate = selectedDate ? new Date(selectedDate) : now
      start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0)
      end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59)
      break
    }
    case 'monthly': {
      const [year, month] = selectedMonth ? selectedMonth.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1]
      start = new Date(year, month - 1, 1, 0, 0, 0)
      end = new Date(year, month, 0, 23, 59, 59)
      break
    }
    case 'yearly': {
      const year = selectedYear ? parseInt(selectedYear) : now.getFullYear()
      start = new Date(year, 0, 1, 0, 0, 0)
      end = new Date(year, 11, 31, 23, 59, 59)
      break
    }
    case 'all':
    default:
      start = new Date(2000, 0, 1)
      end = new Date(2099, 11, 31)
      break
  }

  return { start, end }
}

export default function PenjualanPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // Period filter states
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { start, end } = getDateRange(period, selectedDate, selectedMonth, selectedYear)

    const [salesRes, productsRes, clientsRes, invoicesRes, ordersRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, clients(*), sale_items(*, products(*))')
        .eq('user_id', user.id)
        .gte('sale_date', start.toISOString())
        .lte('sale_date', end.toISOString())
        .order('sale_date', { ascending: false }),
      supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('purchase_invoices')
        .select('*, clients(*)')
        .eq('user_id', user.id)
        .in('status', ['pending', 'used'])
        .order('invoice_date', { ascending: false }),
      supabase
        .from('orders')
        .select('*, clients(*), order_items(*, products(*))')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('order_date', { ascending: false }),
    ])

    const mappedSales = (salesRes.data || []).map((sale) => ({
      ...sale,
      client: sale.clients,
      items: (sale.sale_items || []).map((item: SaleItem & { products: Product }) => ({
        ...item,
        product: item.products,
      })),
    })) as Sale[]

    const mappedInvoices = (invoicesRes.data || []).map(inv => ({
      ...inv,
      client: inv.clients,
    })) as PurchaseInvoice[]

    const mappedOrders = (ordersRes.data || []).map((order) => ({
      ...order,
      client: order.clients,
      items: (order.order_items || []).map((item: OrderItem & { products: Product }) => ({
        ...item,
        product: item.products,
      })),
    })) as Order[]

    setSales(mappedSales)
    setProducts((productsRes.data || []) as Product[])
    setClients((clientsRes.data || []) as Client[])
    setInvoices(mappedInvoices)
    setOrders(mappedOrders)
    setLoading(false)
  }, [period, selectedDate, selectedMonth, selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0)
  const totalCost = sales.reduce((sum, sale) => sum + sale.total_cost, 0)
  const totalProfit = totalSales - totalCost
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Penjualan</h1>
          <p className="text-muted-foreground">Catat transaksi penjualan</p>
        </div>
        <AddSaleDialog 
          products={products} 
          clients={clients} 
          invoices={invoices}
          orders={orders}
          onSuccess={fetchData} 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penjualan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalSales)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Modal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalCost)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Penjualan</CardTitle>
          <CardDescription>Filter penjualan berdasarkan periode</CardDescription>
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
                  <Label htmlFor="sale-date" className="sr-only">Pilih Tanggal</Label>
                  <Input
                    id="sale-date"
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
                  <Label htmlFor="sale-month" className="sr-only">Pilih Bulan</Label>
                  <Input
                    id="sale-month"
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
                  <Label htmlFor="sale-year" className="sr-only">Pilih Tahun</Label>
                  <Input
                    id="sale-year"
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
                <SaleTable 
                  sales={sales} 
                  products={products} 
                  clients={clients} 
                  invoices={invoices}
                  onRefresh={fetchData} 
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
