'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, ShoppingCart, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { AddOrderDialog } from '@/components/add-order-dialog'
import { OrderTable } from '@/components/order-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Order, Client, Product } from '@/lib/types'

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

export default function OrderPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
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
    if (!user) return

    const { start, end } = getDateRange(period, selectedDate, selectedMonth, selectedYear)

    const [ordersRes, clientsRes, productsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, clients(*), order_items(*, products(*))')
        .eq('user_id', user.id)
        .gte('order_date', start.toISOString())
        .lte('order_date', end.toISOString())
        .order('order_date', { ascending: false }),
      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name'),
    ])

    const mappedOrders = (ordersRes.data || []).map(order => ({
      ...order,
      client: order.clients, // Memastikan key client sesuai dengan ekspektasi komponen
      items: order.order_items || []
    }))

    setOrders(mappedOrders as Order[])
    setClients((clientsRes.data || []) as Client[])
    setProducts((productsRes.data || []) as Product[])
    setLoading(false)
  }, [period, selectedDate, selectedMonth, selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalOrders = orders.length
  const totalAmount = orders.reduce((sum, order) => sum + order.total_amount, 0)
  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const completedOrders = orders.filter(o => o.status === 'completed').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Masuk</h1>
          <p className="text-muted-foreground">Monitor dan kelola pesanan masuk dari client.</p>
        </div>
        <AddOrderDialog clients={clients} products={products} onSuccess={fetchData} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Order</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nilai</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalAmount)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingOrders}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selesai</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedOrders}</div>
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
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="animate-pulse">Sinkronisasi data order...</p>
            </div>
          ) : (
            <OrderTable 
              orders={orders} 
              clients={clients} 
              products={products} 
              onRefresh={fetchData} 
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}