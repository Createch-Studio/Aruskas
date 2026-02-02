'use client'

import React from "react"

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, DollarSign, Percent, Package, ShoppingCart, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportExpenseChart } from '@/components/report-expense-chart'
import type { Client } from '@/lib/types'
import { ReportSalesChart } from '@/components/report-sales-chart'
import { ReportProductTable } from '@/components/report-product-table'

type PeriodType = 'daily' | 'monthly' | 'quarterly' | 'yearly' | 'all'

interface ReportData {
  totalSales: number
  totalCost: number
  totalInvoiceCost: number
  totalExpenses: number
  totalProfit: number
  profitMargin: number
  transactionCount: number
  expensesByCategory: { category: string; amount: number }[]
  salesByPeriod: { period: string; sales: number; profit: number }[]
  productPerformance: { 
    id: string
    name: string
    totalSold: number
    totalRevenue: number
    packagingCost: number
    invoiceCost: number
    totalProfit: number
  }[]
}

function getDateRange(period: PeriodType, selectedDate?: string): { start: Date; end: Date } {
  const now = new Date()
  let end: Date
  let start: Date

  switch (period) {
    case 'daily':
      const targetDate = selectedDate ? new Date(selectedDate) : now
      start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0)
      end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59)
      break
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    case 'quarterly':
      const currentQuarter = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), currentQuarter * 3, 1)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    case 'yearly':
      start = new Date(now.getFullYear(), 0, 1)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    case 'all':
    default:
      start = new Date(2000, 0, 1) // Far past date
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
  }

  return { start, end }
}

function getPeriodLabel(period: PeriodType, selectedDate?: string): string {
  const now = new Date()
  switch (period) {
    case 'daily':
      const date = selectedDate ? new Date(selectedDate) : now
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    case 'monthly':
      return now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3) + 1
      return `Q${quarter} ${now.getFullYear()}`
    case 'yearly':
      return `Tahun ${now.getFullYear()}`
    case 'all':
      return 'Semua Waktu'
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default function LaporanPage() {
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [clients, setClients] = useState<Client[]>([])
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReportData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { start, end } = getDateRange(period, selectedDate)

    // Fetch clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    setClients((clientsData || []) as Client[])

    // Build client filter
    const clientFilter = selectedClient !== 'all' ? selectedClient : null

    // Fetch expenses
    let expensesQuery = supabase
      .from('expenses')
      .select('amount, date, expense_categories(name)')
      .eq('user_id', user.id)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString())
    
    if (clientFilter) {
      expensesQuery = expensesQuery.eq('client_id', clientFilter)
    }
    
    const { data: expenses } = await expensesQuery

    const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

    // Group expenses by category
    const categoryTotals: Record<string, number> = {}
    expenses?.forEach((e) => {
      const categoryName = (e.expense_categories as { name: string } | null)?.name || 'Lainnya'
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Number(e.amount)
    })
    const expensesByCategory = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
    }))

    // Fetch sales with items and purchase invoice
    let salesQuery = supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        total_cost,
        additional_cost,
        sale_date,
        client_id,
        purchase_invoice_id,
        purchase_invoices (
          id,
          total_amount
        ),
        sale_items (
          quantity,
          unit_price,
          unit_cost,
          product_id,
          products (id, name)
        )
      `)
      .eq('user_id', user.id)
      .gte('sale_date', start.toISOString())
      .lte('sale_date', end.toISOString())
    
    if (clientFilter) {
      salesQuery = salesQuery.eq('client_id', clientFilter)
    }
    
    const { data: sales } = await salesQuery

    const totalSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
    
    // Calculate total packaging cost from sale_items unit_cost
    const totalPackagingCost = sales?.reduce((sum, s) => {
      const items = s.sale_items as { quantity: number; unit_cost: number }[]
      return sum + (items?.reduce((itemSum, item) => itemSum + (item.quantity * Number(item.unit_cost)), 0) || 0)
    }, 0) || 0
    
    // Calculate total invoice cost from additional_cost
    const totalInvoiceCost = sales?.reduce((sum, s) => sum + Number(s.additional_cost || 0), 0) || 0
    
    const transactionCount = sales?.length || 0

    // Calculate profit: Revenue - Packaging Cost - Invoice Cost - Expenses
    const totalProfit = totalSales - totalPackagingCost - totalInvoiceCost - totalExpenses
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

    // Group sales by period for chart
    const salesByPeriodMap: Record<string, { sales: number; profit: number }> = {}
    sales?.forEach((s) => {
      const date = new Date(s.sale_date)
      let periodKey: string

      if (period === 'monthly') {
        periodKey = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      } else if (period === 'quarterly') {
        periodKey = date.toLocaleDateString('id-ID', { month: 'short' })
      } else if (period === 'yearly') {
        periodKey = date.toLocaleDateString('id-ID', { month: 'short' })
      } else {
        periodKey = date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
      }

      if (!salesByPeriodMap[periodKey]) {
        salesByPeriodMap[periodKey] = { sales: 0, profit: 0 }
      }
      
      // Calculate packaging cost for this sale
      const salePackagingCost = (s.sale_items as { quantity: number; unit_cost: number }[])
        ?.reduce((sum, item) => sum + (item.quantity * Number(item.unit_cost)), 0) || 0
      
      salesByPeriodMap[periodKey].sales += Number(s.total_amount)
      salesByPeriodMap[periodKey].profit += Number(s.total_amount) - salePackagingCost - Number(s.additional_cost || 0)
    })

    const salesByPeriod = Object.entries(salesByPeriodMap).map(([periodKey, values]) => ({
      period: periodKey,
      sales: values.sales,
      profit: values.profit,
    }))

    // Calculate product performance with Packaging Cost and Invoice Cost
    const productStats: Record<string, { name: string; totalSold: number; totalRevenue: number; packagingCost: number; invoiceCost: number; totalProfit: number }> = {}
    sales?.forEach((s) => {
      const items = s.sale_items as {
        quantity: number
        unit_price: number
        unit_cost: number
        product_id: string
        products: { id: string; name: string } | null
      }[]
      
      // Get additional costs for this sale
      const saleInvoiceCost = Number(s.additional_cost || 0)
      const totalItemsInSale = items?.reduce((sum, item) => sum + item.quantity, 0) || 1
      
      items?.forEach((item) => {
        const productId = item.product_id
        const productName = item.products?.name || 'Unknown'
        
        if (!productStats[productId]) {
          productStats[productId] = { name: productName, totalSold: 0, totalRevenue: 0, packagingCost: 0, invoiceCost: 0, totalProfit: 0 }
        }
        
        // Packaging cost from unit_cost (cost per item set in sales)
        const itemPackagingCost = item.quantity * Number(item.unit_cost)
        
        // Distribute invoice cost proportionally based on quantity
        const itemInvoiceCostShare = (item.quantity / totalItemsInSale) * saleInvoiceCost
        
        const itemRevenue = item.quantity * Number(item.unit_price)
        const itemProfit = itemRevenue - itemPackagingCost - itemInvoiceCostShare
        
        productStats[productId].totalSold += item.quantity
        productStats[productId].totalRevenue += itemRevenue
        productStats[productId].packagingCost += itemPackagingCost
        productStats[productId].invoiceCost += itemInvoiceCostShare
        productStats[productId].totalProfit += itemProfit
      })
    })

    const productPerformance = Object.entries(productStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.totalProfit - a.totalProfit)

    const totalCost = sales?.reduce((sum, s) => sum + Number(s.total_cost), 0) || 0

    setData({
      totalSales,
      totalCost: totalPackagingCost,
      totalInvoiceCost,
      totalExpenses,
      totalProfit,
      profitMargin,
      transactionCount,
      expensesByCategory,
      salesByPeriod,
      productPerformance,
    })
    setLoading(false)
  }, [period, selectedDate, selectedClient])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Laporan Keuangan</h1>
        <p className="text-muted-foreground">
          Analisis performa bisnis Anda
        </p>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
        <TabsList className="grid w-full grid-cols-5 lg:w-[500px]">
          <TabsTrigger value="daily">Harian</TabsTrigger>
          <TabsTrigger value="monthly">Bulanan</TabsTrigger>
          <TabsTrigger value="quarterly">Kuartal</TabsTrigger>
          <TabsTrigger value="yearly">Tahunan</TabsTrigger>
          <TabsTrigger value="all">Semua</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg font-semibold">
              {getPeriodLabel(period, selectedDate)}
              {selectedClient !== 'all' && clients.find(c => c.id === selectedClient) && (
                <span className="ml-2 text-muted-foreground font-normal">
                  - {clients.find(c => c.id === selectedClient)?.name}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4">
              {period === 'daily' && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="report-date" className="sr-only">Pilih Tanggal</Label>
                  <Input
                    id="report-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="client-filter" className="text-sm text-muted-foreground whitespace-nowrap">Client:</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Semua Client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-muted-foreground">Memuat data...</div>
            </div>
          ) : data ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Penjualan</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(data.totalSales)}</div>
                    <p className="text-xs text-muted-foreground">{data.transactionCount} transaksi</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</div>
                    <p className="text-xs text-muted-foreground">HPP: {formatCurrency(data.totalCost + data.totalInvoiceCost)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Profit Bersih</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={cn(
                      "text-2xl font-bold",
                      data.totalProfit >= 0 ? "text-green-600" : "text-destructive"
                    )}>
                      {formatCurrency(data.totalProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground">Setelah HPP & Pengeluaran</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={cn(
                      "text-2xl font-bold",
                      data.profitMargin >= 0 ? "text-green-600" : "text-destructive"
                    )}>
                      {data.profitMargin.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Dari total penjualan</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Pengeluaran per Kategori
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.expensesByCategory.length > 0 ? (
                      <ReportExpenseChart data={data.expensesByCategory} />
                    ) : (
                      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        Tidak ada data pengeluaran
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Tren Penjualan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.salesByPeriod.length > 0 ? (
                      <ReportSalesChart data={data.salesByPeriod} />
                    ) : (
                      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        Tidak ada data penjualan
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Product Profit */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Profit Bersih & Margin Produk
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.productPerformance.length > 0 ? (
                    <ReportProductTable data={data.productPerformance} />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                      Tidak ada data produk terjual
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <div className="text-muted-foreground">Tidak ada data</div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Receipt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  )
}
