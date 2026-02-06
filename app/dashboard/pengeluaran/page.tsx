'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExpenseTable } from '@/components/expense-table'
import { AddExpenseDialog } from '@/components/add-expense-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Wallet, Tag, Users, Search } from 'lucide-react'
import type { Expense, ExpenseCategory, Client } from '@/lib/types'

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

export default function PengeluaranPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  
  // Filter states
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterSearch, setFilterSearch] = useState<string>('')

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { start, end } = getDateRange(period, selectedDate, selectedMonth, selectedYear)

    const [expensesRes, categoriesRes, clientsRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, expense_categories(id, name), clients(*)')
        .eq('user_id', user.id)
        .gte('date', start.toISOString().split('T')[0])
        .lte('date', end.toISOString().split('T')[0])
        .order('date', { ascending: false }),
      supabase
        .from('expense_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
    ])

    const mappedExpenses = (expensesRes.data || []).map((e) => ({
      ...e,
      category: e.expense_categories,
      client: e.clients,
    }))

    setExpenses(mappedExpenses as Expense[])
    setCategories((categoriesRes.data || []) as ExpenseCategory[])
    setClients((clientsRes.data || []) as Client[])
    setLoading(false)
  }, [period, selectedDate, selectedMonth, selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Logic filter client-side agar responsif tanpa fetch ulang
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchCategory = filterCategory === 'all' || e.category_id === filterCategory
      const matchClient = filterClient === 'all' || e.client_id === filterClient
      const matchSearch = e.description?.toLowerCase().includes(filterSearch.toLowerCase()) || 
                          e.category?.name.toLowerCase().includes(filterSearch.toLowerCase())
      return matchCategory && matchClient && matchSearch
    })
  }, [expenses, filterCategory, filterClient, filterSearch])

  const totalExpense = useMemo(() => filteredExpenses.reduce((sum, e) => sum + e.amount, 0), [filteredExpenses])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengeluaran</h1>
          <p className="text-muted-foreground">Catat dan pantau biaya operasional bisnis Anda</p>
        </div>
        <AddExpenseDialog categories={categories} clients={clients} onSuccess={fetchData} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpense)}</div>
            <p className="text-xs text-muted-foreground mt-1">Berdasarkan filter aktif</p>
          </CardContent>
        </Card>
        {/* Tambahan statistik cepat lainnya bisa di sini */}
      </div>

      <Card>
        <CardHeader>
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
                {period === 'daily' && <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border-none bg-transparent h-8 w-[150px] focus-visible:ring-0" />}
                {period === 'monthly' && <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border-none bg-transparent h-8 w-[150px] focus-visible:ring-0" />}
                {period === 'yearly' && <Input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="border-none bg-transparent h-8 w-[80px] focus-visible:ring-0" />}
                {period === 'all' && <span className="text-sm font-medium px-2">Semua Transaksi</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari deskripsi..."
                    className="pl-8"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger>
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Client Terkait" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tanpa Filter Client</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
               <p>Menghitung pengeluaran...</p>
            </div>
          ) : (
            <ExpenseTable
              expenses={filteredExpenses}
              categories={categories}
              clients={clients}
              onRefresh={fetchData}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}