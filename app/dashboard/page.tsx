import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, Percent, Calendar } from 'lucide-react'
import { ExpenseChart } from '@/components/expense-chart'
import { SalesChart } from '@/components/sales-chart'

async function getDashboardData(userId: string) {
  const supabase = await createClient()
  
  // Rentang waktu bulan ini
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // 1. Ambil Pengeluaran Bulan Ini
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('amount, expense_categories(name)')
    .eq('user_id', userId)
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  // Filter: Hanya biaya operasional (Bukan Invoice Belanja)
  const operationalExpensesData = rawExpenses?.filter(e => 
    (e.expense_categories as any)?.name !== 'Invoice Belanja'
  ) || []

  const totalOperationalExpenses = operationalExpensesData.reduce((sum, e) => sum + Number(e.amount), 0)

  // 2. Ambil Penjualan Bulan Ini
  const { data: sales } = await supabase
    .from('sales')
    .select('total_amount, total_cost, additional_cost')
    .eq('user_id', userId)
    .gte('sale_date', startOfMonth)
    .lte('sale_date', endOfMonth)

  const totalSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
  
  // HPP = Modal Barang + Biaya Tambahan Penjualan
  const totalHpp = sales?.reduce((sum, s) => 
    sum + Number(s.total_cost || 0) + Number(s.additional_cost || 0), 0
  ) || 0

  // Profit Bersih = Omzet - HPP - Biaya Operasional (Listrik, Gaji, dll)
  const totalProfit = totalSales - totalHpp - totalOperationalExpenses
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  // 3. Persiapan Data Chart Pengeluaran (Kategori)
  const categoryTotals: Record<string, number> = {}
  operationalExpensesData.forEach((e) => {
    const categoryName = (e.expense_categories as any)?.name || 'Lainnya'
    categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Number(e.amount)
  })

  const expenseChartData = Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    amount,
  }))

  // 4. Trend 90 Hari Terakhir
  const last90Days = new Date()
  last90Days.setDate(last90Days.getDate() - 90)
  
  const { data: recentSales } = await supabase
    .from('sales')
    .select('sale_date, total_amount, total_cost, additional_cost')
    .eq('user_id', userId)
    .gte('sale_date', last90Days.toISOString())
    .order('sale_date', { ascending: true })

  const salesByDate: Record<string, { sales: number; profit: number }> = {}
  recentSales?.forEach((s) => {
    const date = new Date(s.sale_date).toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short' 
    })
    if (!salesByDate[date]) {
      salesByDate[date] = { sales: 0, profit: 0 }
    }
    const saleHpp = Number(s.total_cost || 0) + Number(s.additional_cost || 0)
    salesByDate[date].sales += Number(s.total_amount)
    // Profit per hari di chart ini bersifat "Profit Kotor" (Belum dikurangi operasional bulanan)
    salesByDate[date].profit += Number(s.total_amount) - saleHpp
  })

  const salesChartData = Object.entries(salesByDate).map(([date, data]) => ({
    date,
    sales: data.sales,
    profit: data.profit,
  }))

  return {
    totalExpenses: totalOperationalExpenses,
    totalSales,
    totalHpp,
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null
  const data = await getDashboardData(user.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Performa Bisnis & Tren 90 Hari
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Omzet Bulan Ini</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalSales)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pendapatan masuk</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Biaya Operasional</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</div>
            <p className="text-xs text-orange-600 font-medium mt-1">HPP Terjual: {formatCurrency(data.totalHpp)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Profit Bersih</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              data.totalProfit >= 0 ? "text-green-700" : "text-destructive"
            )}>
              {formatCurrency(data.totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 italic">Sudah dikurangi modal & operasional</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <Percent className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              data.profitMargin >= 0 ? "text-slate-800" : "text-destructive"
            )}>
              {data.profitMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Efisiensi keuntungan</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Grafik Penjualan & Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <SalesChart data={data.salesChartData} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribusi Biaya Operasional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ExpenseChart data={data.expenseChartData} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}