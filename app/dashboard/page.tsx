import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react'
import { ExpenseChart } from '@/components/expense-chart'
import { SalesChart } from '@/components/sales-chart'

async function getDashboardData(userId: string) {
  const supabase = await createClient()
  
  // Get current month date range
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  // Get total expenses for current month
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('user_id', userId)
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

  // Get total sales and costs for current month
  const { data: sales } = await supabase
    .from('sales')
    .select('total_amount, total_cost')
    .eq('user_id', userId)
    .gte('sale_date', startOfMonth)
    .lte('sale_date', endOfMonth)

  const totalSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
  const totalCost = sales?.reduce((sum, s) => sum + Number(s.total_cost), 0) || 0

  // Calculate profit (sales - cost - expenses)
  const totalProfit = totalSales - totalCost - totalExpenses
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  // Get expenses by category for chart
  const { data: expensesByCategory } = await supabase
    .from('expenses')
    .select('amount, expense_categories(name)')
    .eq('user_id', userId)
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  const categoryTotals: Record<string, number> = {}
  expensesByCategory?.forEach((e) => {
    const categoryName = (e.expense_categories as { name: string } | null)?.name || 'Lainnya'
    categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Number(e.amount)
  })

  const expenseChartData = Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    amount,
  }))

  // Get sales by date for chart (last 7 days)
  const last7Days = new Date()
  last7Days.setDate(last7Days.getDate() - 7)
  
  const { data: recentSales } = await supabase
    .from('sales')
    .select('sale_date, total_amount, total_cost')
    .eq('user_id', userId)
    .gte('sale_date', last7Days.toISOString())
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
    salesByDate[date].sales += Number(s.total_amount)
    salesByDate[date].profit += Number(s.total_amount) - Number(s.total_cost)
  })

  const salesChartData = Object.entries(salesByDate).map(([date, data]) => ({
    date,
    sales: data.sales,
    profit: data.profit,
  }))

  return {
    totalExpenses,
    totalSales,
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

  if (!user) {
    return null
  }

  const data = await getDashboardData(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Ringkasan keuangan bulan ini
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penjualan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalSales)}</div>
            <p className="text-xs text-muted-foreground">Bulan ini</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Bulan ini</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              data.totalProfit >= 0 ? "text-green-600" : "text-destructive"
            )}>
              {formatCurrency(data.totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Bulan ini</p>
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
            <p className="text-xs text-muted-foreground">Bulan ini</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pengeluaran per Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseChart data={data.expenseChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Penjualan 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart data={data.salesChartData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
