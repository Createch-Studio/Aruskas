import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Calendar, Package } from 'lucide-react'
import { ExpenseChart } from '@/components/expense-chart'
import { SalesChart } from '@/components/sales-chart'

async function getDashboardData(userId: string) {
  const supabase = await createClient()
  
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // 1. FETCH EXPENSES
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('amount, expense_categories(name)')
    .eq('user_id', userId)
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  const operationalExpenses = rawExpenses?.filter(e => 
    (e.expense_categories as any)?.name !== 'Invoice Belanja'
  ) || []

  const totalExpenses = operationalExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // 2. FETCH SALES & TOP PRODUCTS
  const { data: sales } = await supabase
    .from('sales')
    .select(`
      total_amount,
      additional_cost,
      sale_date,
      sale_items (
        quantity,
        unit_cost,
        products (name)
      )
    `)
    .eq('user_id', userId)
    .gte('sale_date', startOfMonth)
    .lte('sale_date', endOfMonth)

  const totalSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0
  const totalPackagingCost = sales?.reduce((sum, s) => {
    const items = (s.sale_items as any[]) || []
    return sum + items.reduce((itemSum, item) => itemSum + (item.quantity * Number(item.unit_cost)), 0)
  }, 0) || 0
  const totalInvoiceCost = sales?.reduce((sum, s) => sum + Number(s.additional_cost || 0), 0) || 0

  const totalProfit = totalSales - totalPackagingCost - totalInvoiceCost - totalExpenses
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

  // 3. LOGIKA TOP PRODUK
  const productMap: Record<string, { name: string; quantity: number }> = {}
  sales?.forEach(sale => {
    const items = (sale.sale_items as any[]) || []
    items.forEach(item => {
      const name = item.products?.name || 'Produk Terhapus'
      if (!productMap[name]) productMap[name] = { name, quantity: 0 }
      productMap[name].quantity += item.quantity
    })
  })
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

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

  // 5. TREND 90 HARI (Sinkronisasi Key: penjualan & profit)
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

  const salesByDate: Record<string, { sales: number; profit: number }> = {}
  recentSales?.forEach((s) => {
    const dateKey = s.sale_date 
    if (!salesByDate[dateKey]) salesByDate[dateKey] = { sales: 0, profit: 0 }
    
    const items = (s.sale_items as any[]) || []
    const salePackagingCost = items.reduce((sum, item) => sum + (item.quantity * Number(item.unit_cost)), 0)
    
    salesByDate[dateKey].sales += Number(s.total_amount)
    salesByDate[dateKey].profit += Number(s.total_amount) - salePackagingCost - Number(s.additional_cost || 0)
  })

  const salesChartData = Object.entries(salesByDate)
    .map(([date, values]) => ({
      date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      penjualan: values.sales, // Key diubah ke 'penjualan'
      profit: values.profit,    
      rawDate: date
    }))
    .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())

  return {
    totalSales, totalExpenses, totalHpp: totalPackagingCost + totalInvoiceCost,
    totalProfit, profitMargin, expenseChartData, salesChartData, topProducts
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const data = await getDashboardData(user.id)

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4" /> Monitoring Performa Bisnis
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Omzet Bulan Ini" value={data.totalSales} subtitle="Total pendapatan kotor" color="blue" />
        <SummaryCard title="Biaya & HPP" value={data.totalExpenses + data.totalHpp} subtitle={`HPP: ${formatCurrency(data.totalHpp)} | Ops: ${formatCurrency(data.totalExpenses)}`} color="orange" />
        <SummaryCard title="Profit Bersih" value={data.totalProfit} subtitle="Sudah dikurangi semua biaya" color="green" isProfit />
        <SummaryCard title="Margin" value={`${data.profitMargin.toFixed(1)}%`} subtitle="Efficiency Level" color="slate" isRaw />
      </div>

      {/* Main Chart: Tren Penjualan & Profit */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-8">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" /> Tren Penjualan & Profit (90 Hari)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px]">
          {data.salesChartData.length > 0 ? (
            <SalesChart data={data.salesChartData} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm italic">Belum ada data penjualan</div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid: Expenses & Products */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm border-slate-200">
          <CardHeader><CardTitle className="text-base font-semibold">Distribusi Biaya Operasional</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
             {data.expenseChartData.length > 0 ? <ExpenseChart data={data.expenseChartData} /> : <NoData />}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" /> Top Produk Terlaris
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topProducts.length > 0 ? data.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{i + 1}</div>
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{p.quantity} unit</p>
                </div>
              )) : <NoData />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({ title, value, subtitle, color, isProfit, isRaw }: any) {
  const colorMap: any = { blue: 'border-l-blue-500', orange: 'border-l-orange-500', green: 'border-l-green-500', slate: 'border-l-slate-400' }
  return (
    <Card className={`border-l-4 ${colorMap[color]} shadow-sm`}>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-tight">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isProfit && value < 0 ? 'text-destructive' : ''}`}>{isRaw ? value : formatCurrency(value)}</div>
        <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function NoData() { return <div className="flex h-full items-center justify-center text-muted-foreground text-sm italic">Belum ada data</div> }