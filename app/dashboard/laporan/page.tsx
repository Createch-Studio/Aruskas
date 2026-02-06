'use client'

import React from "react"
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, DollarSign, Percent, Package, ShoppingCart, Calendar, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
      start = new Date(2000, 0, 1)
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
      return `Kuartal ${quarter} ${now.getFullYear()}`
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
    maximumFractionDigits: 0,
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

    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    setClients((clientsData || []) as Client[])
    const clientFilter = selectedClient !== 'all' ? selectedClient : null

    // 1. FETCH EXPENSES
    let expensesQuery = supabase
      .from('expenses')
      .select('amount, date, expense_categories(name)')
      .eq('user_id', user.id)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString())
    
    if (clientFilter) expensesQuery = expensesQuery.eq('client_id', clientFilter)
    
    const { data: expenses } = await expensesQuery

    // LOGIKA KRUSIAL: Filter agar 'Invoice Belanja' tidak dihitung dobel
    const operationalExpenses = expenses?.filter(e => 
      (e.expense_categories as any)?.name !== 'Invoice Belanja'
    ) || []

    const totalExpenses = operationalExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

    const categoryTotals: Record<string, number> = {}
    operationalExpenses.forEach((e) => {
      const categoryName = (e.expense_categories as any)?.name || 'Lainnya'
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Number(e.amount)
    })
    const expensesByCategory = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
    }))

    // 2. FETCH SALES
    let salesQuery = supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        additional_cost,
        sale_date,
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
    
    if (clientFilter) salesQuery = salesQuery.eq('client_id', clientFilter)
    
    const { data: sales } = await salesQuery

    const totalSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
    const totalPackagingCost = sales?.reduce((sum, s) => {
      const items = s.sale_items as any[]
      return sum + (items?.reduce((itemSum, item) => itemSum + (item.quantity * Number(item.unit_cost)), 0) || 0)
    }, 0) || 0
    
    const totalInvoiceCost = sales?.reduce((sum, s) => sum + Number(s.additional_cost || 0), 0) || 0
    const transactionCount = sales?.length || 0

    // PROFIT = Sales - HPP (Packaging + Invoice) - Operational Expenses
    const totalProfit = totalSales - totalPackagingCost - totalInvoiceCost - totalExpenses
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

    // Grouping Tren
    const salesByPeriodMap: Record<string, { sales: number; profit: number }> = {}
    sales?.forEach((s) => {
      const date = new Date(s.sale_date)
      let periodKey = period === 'monthly' 
        ? date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
        : date.toLocaleDateString('id-ID', { month: 'short' })

      if (!salesByPeriodMap[periodKey]) salesByPeriodMap[periodKey] = { sales: 0, profit: 0 }
      
      const salePackagingCost = (s.sale_items as any[])?.reduce((sum, item) => sum + (item.quantity * Number(item.unit_cost)), 0) || 0
      salesByPeriodMap[periodKey].sales += Number(s.total_amount)
      salesByPeriodMap[periodKey].profit += Number(s.total_amount) - salePackagingCost - Number(s.additional_cost || 0)
    })

    const salesByPeriod = Object.entries(salesByPeriodMap).map(([periodKey, values]) => ({
      period: periodKey,
      sales: values.sales,
      profit: values.profit,
    }))

    // Product Stats
    const productStats: Record<string, any> = {}
    sales?.forEach((s) => {
      const items = s.sale_items as any[]
      const saleInvoiceCost = Number(s.additional_cost || 0)
      const totalItemsInSale = items?.reduce((sum, item) => sum + item.quantity, 0) || 1
      
      items?.forEach((item) => {
        const productId = item.product_id
        if (!productStats[productId]) {
          productStats[productId] = { name: item.products?.name || 'Unknown', totalSold: 0, totalRevenue: 0, packagingCost: 0, invoiceCost: 0, totalProfit: 0 }
        }
        const itemPackagingCost = item.quantity * Number(item.unit_cost)
        const itemInvoiceCostShare = (item.quantity / totalItemsInSale) * saleInvoiceCost
        const itemRevenue = item.quantity * Number(item.unit_price)
        
        productStats[productId].totalSold += item.quantity
        productStats[productId].totalRevenue += itemRevenue
        productStats[productId].packagingCost += itemPackagingCost
        productStats[productId].invoiceCost += itemInvoiceCostShare
        productStats[productId].totalProfit += (itemRevenue - itemPackagingCost - itemInvoiceCostShare)
      })
    })

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
      productPerformance: Object.entries(productStats).map(([id, stats]: any) => ({ id, ...stats })).sort((a, b) => b.totalProfit - a.totalProfit),
    })
    setLoading(false)
  }, [period, selectedDate, selectedClient])

  useEffect(() => { fetchReportData() }, [fetchReportData])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Laporan Keuangan</h1>
        <p className="text-muted-foreground italic flex items-center gap-2">
          <Info className="h-4 w-4" /> Data pengeluaran otomatis dari invoice sudah digabung ke dalam HPP
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
            <h2 className="text-lg font-semibold">{getPeriodLabel(period, selectedDate)}</h2>
            <div className="flex items-center gap-4">
              {period === 'daily' && (
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
              )}
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Semua Client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Client</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground animate-pulse">Menghitung laporan...</div>
          ) : data ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Omzet</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(data.totalSales)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{data.transactionCount} transaksi berhasil</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Biaya Operasional</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                        HPP Bahan: {formatCurrency(data.totalInvoiceCost)}<br/>
                        HPP Kemas: {formatCurrency(data.totalCost)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Profit Bersih</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={cn("text-2xl font-bold", data.totalProfit >= 0 ? "text-green-600" : "text-destructive")}>
                      {formatCurrency(data.totalProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Setelah HPP & Operasional</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Margin</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={cn("text-2xl font-bold", data.profitMargin >= 0 ? "text-green-600" : "text-destructive")}>
                      {data.profitMargin.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Efisiensi keuntungan</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Top Produk</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.productPerformance.slice(0, 5).map((p, i) => (
                                <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                                    <div className="text-sm font-medium">{p.name} <span className="text-muted-foreground font-normal ml-1">x{p.totalSold}</span></div>
                                    <div className="text-sm font-bold text-green-600">{formatCurrency(p.totalProfit)}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Tren Penjualan</CardTitle></CardHeader>
                    <CardContent><ReportSalesChart data={data.salesByPeriod} /></CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Detail Profit Per Produk</CardTitle></CardHeader>
                <CardContent><ReportProductTable data={data.productPerformance} /></CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}