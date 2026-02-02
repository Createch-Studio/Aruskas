'use client'

import { SelectItem } from "@/components/ui/select"
import { SelectContent } from "@/components/ui/select"
import { SelectValue } from "@/components/ui/select"
import { SelectTrigger } from "@/components/ui/select"
import { Select } from "@/components/ui/select"
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExpenseTable } from '@/components/expense-table'
import { AddExpenseDialog } from '@/components/add-expense-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from 'lucide-react'
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
    case 'all':
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
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterSearch, setFilterSearch] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([])

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
      category: e.expense_categories as ExpenseCategory | undefined,
      client: e.clients as Client | undefined,
    })) as Expense[]

    setExpenses(mappedExpenses)
    setCategories((categoriesRes.data || []) as ExpenseCategory[])
    setClients((clientsRes.data || []) as Client[])
    setFilteredExpenses(mappedExpenses)
    setLoading(false)
  }, [period, selectedDate, selectedMonth, selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengeluaran</h1>
          <p className="text-muted-foreground">Kelola pengeluaran bisnis Anda</p>
        </div>
        <AddExpenseDialog categories={categories} clients={clients} onSuccess={fetchData} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengeluaran</CardTitle>
          <CardDescription>Filter pengeluaran berdasarkan periode</CardDescription>
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
                  <Label htmlFor="expense-date" className="sr-only">Pilih Tanggal</Label>
                  <Input
                    id="expense-date"
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
                  <Label htmlFor="expense-month" className="sr-only">Pilih Bulan</Label>
                  <Input
                    id="expense-month"
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
                  <Label htmlFor="expense-year" className="sr-only">Pilih Tahun</Label>
                  <Input
                    id="expense-year"
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
                <ExpenseTable
                  expenses={filteredExpenses}
                  categories={categories}
                  clients={clients}
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
