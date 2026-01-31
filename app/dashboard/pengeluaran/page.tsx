'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExpenseTable } from '@/components/expense-table'
import { AddExpenseDialog } from '@/components/add-expense-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Expense, ExpenseCategory, Client } from '@/lib/types'

export default function PengeluaranPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [filterSearch, setFilterSearch] = useState<string>('')

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const [expensesRes, categoriesRes, clientsRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, expense_categories(id, name), clients(*)')
        .eq('user_id', user.id)
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
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    if (filterCategory !== 'all' && expense.category_id !== filterCategory) return false
    if (filterClient !== 'all') {
      if (filterClient === 'none' && expense.client_id !== null) return false
      if (filterClient !== 'none' && expense.client_id !== filterClient) return false
    }
    if (filterDateFrom && expense.date < filterDateFrom) return false
    if (filterDateTo && expense.date > filterDateTo) return false
    if (filterSearch && !expense.description.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

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
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Cari</Label>
              <Input
                placeholder="Cari deskripsi..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Client</SelectItem>
                  <SelectItem value="none">Tanpa Client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dari Tanggal</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sampai Tanggal</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Pengeluaran ({filteredExpenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Memuat data...</div>
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
