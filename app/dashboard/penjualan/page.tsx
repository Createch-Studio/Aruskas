'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Banknote, ShoppingBag, TrendingUp, Percent } from 'lucide-react'
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

  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))

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
      items: (sale.sale_items || []).map((item: any) => ({
        ...item,
        product: item.products,
      })),
    }))

    const mappedInvoices = (invoicesRes.data || []).map((inv: any) => ({
      ...inv,
      client: inv.clients,
    }))

    const mappedOrders = (ordersRes.data || []).map((order: any) => ({
      ...order,
      client: order.clients,
      items: (order.order_items || []).map((item: any) => ({
        ...item,
        product: item.products,
      })),
    }))

    setSales(mappedSales as Sale[])
    setProducts((productsRes.data || []) as Product[])
    setClients((clientsRes.data || []) as Client[])
    setInvoices(mappedInvoices as PurchaseInvoice[])
    setOrders(mappedOrders as Order[])
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Penjualan</h1>
          <p className="text-muted-foreground">Catat dan analisis performa keuntungan bisnis Anda.</p>
        </div>
        <AddSaleDialog 
          products={products} 
          clients={clients} 
          invoices={invoices}
          orders={orders}
          onSuccess={fetchData} 
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Penjualan</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Modal</CardTitle>
            <ShoppingBag className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalCost)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Profit Bersih</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalProfit)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margin Profit</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(1)}%
            </div>
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

            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md px-3 border">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {period === 'daily' && (
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-none bg-transparent h-8 w-[150px] focus-visible:ring-0"
                />
              )}
              {period === 'monthly' && (
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border-none bg-transparent h-8 w-[150px] focus-visible:ring-0"
                />
              )}
              {period === 'yearly' && (
                <Input
                  type="number"
                  min="2000"
                  max="2099"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="border-none bg-transparent h-8 w-[80px] focus-visible:ring-0"
                />
              )}
              {period === 'all' && <span className="text-sm font-medium px-2">Data Historis</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
               <p className="animate-pulse">Menghitung keuntungan...</p>
            </div>
          ) : (
            <SaleTable 
              sales={sales} 
              products={products} 
              clients={clients} 
              invoices={invoices}
              onRefresh={fetchData} 
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}