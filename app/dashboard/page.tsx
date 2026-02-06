import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, Percent, Calendar } from 'lucide-react'
import { ExpenseChart } from '@/components/expense-chart'
import { SalesChart } from '@/components/sales-chart'

async function getDashboardData(userId: string) {
  const supabase = await createClient()
  
  // 1. SET RENTANG WAKTU
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // 2. FETCH EXPENSES (Sama dengan Laporan)
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('amount, expense_categories(name)')
    .eq('user_id', userId)
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  // Filter: Abaikan 'Invoice Belanja' karena masuk ke HPP di tabel Sales
  const operationalExpenses = rawExpenses?.filter(e => 
    (e.expense_categories as any)?.name !== 'Invoice Belanja'
  ) || []

  const totalExpenses = operationalExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // 3. FETCH SALES DENGAN ITEM (Sama dengan Laporan)
  const { data: sales } = await supabase
    .from('sales')
    .select(`
      total_amount,
      additional_cost,
      sale_date,
      sale_items (
        quantity,
        unit_cost
      )
    `)
    .eq('user_id', userId)
    .gte('sale_date', startOfMonth)
    .lte('sale_date', endOfMonth)

  const totalSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
  
  // HPP Kemas (dari item)
  const totalPackagingCost = sales?.reduce((sum, s) => {
    const items = (s.sale_items as any[]) || []
    return sum + items.reduce((itemSum, item) => itemSum + (item.quantity * Number(item.unit_cost)), 0)
  }, 0) || 0
  
  // HPP Bahan (dari additional_cost)
  const totalInvoiceCost = sales?.reduce((sum, s) => sum + Number(s.additional_cost || 0), 0) || 0

  // PROFIT BERSIH = Sales - HPP - Operasional
  const totalProfit = totalSales - totalPackagingCost - totalInvoiceCost - totalExpenses
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  // 4. DATA CHART PENGELUARAN
  const categoryTotals: Record<string, number> = {}
  operationalExpenses.forEach((e) => {
    const categoryName = (e.expense_categories as any)?.name || 'Lainnya'
    categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Number(e.amount)
  })
  const expenseChartData = Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    amount,
  }))

  // 5. TREND 90 HARI (Logika agar garis muncul)
  const last90Days = new Date()
  last90Days.setDate(last90Days.getDate() - 90)
  
  const { data: recentSales } = await supabase
    .from('sales')
    .select(`
      sale_date, 
      total_amount, 
      additional_cost,
      sale_items (quantity, unit_cost)
    `)
    .eq('user_id', userId)
    .gte('sale_date', last90Days.toISOString())
    .order('sale_date', { ascending: true })

  // Akumulasi data per tanggal mentah (YYYY-MM-DD)
  const salesByDate: Record<string, { sales: number; profit: number }> = {}
  recentSales?.forEach((s) => {
    const dateKey = s.sale_date 
    if (!salesByDate[dateKey]) {
      salesByDate[dateKey] = { sales: 0, profit: 0 }
    }
    
    const items = (s.sale_items as any[]) || []
    const salePackagingCost = items.reduce((sum, item) => sum + (item.quantity * Number(item.unit_cost)), 0)
    
    salesByDate[dateKey].sales += Number(s.total_amount)
    salesByDate[dateKey].profit += Number(s.total_amount) - salePackagingCost - Number(s.additional_cost || 0)
  })

  // Format ke Array dan urutkan berdasarkan waktu
  const salesChartData = Object.entries(salesByDate)
    .map(([date, values]) => ({
      date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      sales: values.sales,
      profit: values.profit,
      rawDate: date
    }))
    .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())

  return {
    totalSales,
    totalExpenses,
    totalHpp: totalPackagingCost + totalInvoiceCost,
    totalProfit,
    profitMargin,
    expenseChartData,
    salesChartData,
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const data = await getDashboardData(user.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" /> Monitoring Performa Bisnis (Sinkron dengan Laporan)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Omzet */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Omzet Bulan Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalSales)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total pendapatan kotor</p>
          </CardContent>
        </Card>

        {/* Biaya & HPP */}
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Biaya & HPP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses + data.totalHpp)}</div>
            <p className="text-[10px] text-orange-600 font-medium mt-1 uppercase">
              HPP: {formatCurrency(data.totalHpp)} | Ops: {formatCurrency(data.totalExpenses)}
            </p>
          </CardContent>
        </Card>

        {/* Profit Bersih */}
        <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Profit Bersih</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.totalProfit >= 0 ? "text-green-700" : "text-destructive"}`}>
              {formatCurrency(data.totalProfit)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 italic">Sudah dikurangi semua biaya</p>
          </CardContent>
        </Card>

        {/* Margin */}
        <Card className="border-l-4 border-l-slate-400 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.profitMargin.toFixed(1)}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Efficiency Level</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Tren Penjualan & Profit (90 Hari)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {data.salesChartData.length > 0 ? (
              <SalesChart data={data.salesChartData} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Belum ada data penjualan</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribusi Biaya Operasional</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
             {data.expenseChartData.length > 0 ? (
              <ExpenseChart data={data.expenseChartData} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Belum ada data pengeluaran</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}