'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InventoryAssetTable } from '@/components/inventory-asset-table'
import { CashTable } from '@/components/cash-table'
import { DebtTable } from '@/components/debt-table'
import { ReceivableTable } from '@/components/receivable-table'
import type { InventoryItem, Cash, Debt, Receivable } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

export default function AsetPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [cash, setCash] = useState<Cash[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const [inventoryRes, cashRes, debtsRes, receivablesRes] = await Promise.all([
      supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('cash')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('debts')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true }),
      supabase
        .from('receivables')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true }),
    ])

    setInventory((inventoryRes.data || []) as InventoryItem[])
    setCash((cashRes.data || []) as Cash[])
    setDebts((debtsRes.data || []) as Debt[])
    setReceivables((receivablesRes.data || []) as Receivable[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Calculate totals
  const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)
  const totalCash = cash.reduce((sum, account) => sum + account.amount, 0)
  const totalDebt = debts.reduce((sum, debt) => sum + debt.remaining_amount, 0)
  const totalReceivable = receivables.reduce((sum, rec) => sum + rec.remaining_amount, 0)
  const netAssets = totalInventoryValue + totalCash + totalReceivable - totalDebt

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aset</h1>
        <p className="text-muted-foreground">Kelola aset bisnis Anda</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Aset Bersih</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(netAssets)}</div>
            <p className="text-xs text-muted-foreground">Setelah dikurangi utang</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Inventaris</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInventoryValue)}</div>
            <p className="text-xs text-muted-foreground">{inventory.length} item</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Kas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCash)}</div>
            <p className="text-xs text-muted-foreground">{cash.length} akun</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-destructive">Utang</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalDebt)}</div>
            <p className="text-xs text-muted-foreground">{debts.filter(d => d.status !== 'paid').length} aktif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">Piutang</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceivable)}</div>
            <p className="text-xs text-muted-foreground">{receivables.filter(r => r.status !== 'paid').length} aktif</p>
          </CardContent>
        </Card>
      </div>

      {/* Asset Tables */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Aset</CardTitle>
          <CardDescription>Kelola semua jenis aset bisnis Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="inventory" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="inventory">Inventaris</TabsTrigger>
              <TabsTrigger value="cash">Kas</TabsTrigger>
              <TabsTrigger value="debt">Utang</TabsTrigger>
              <TabsTrigger value="receivable">Piutang</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : (
                <InventoryAssetTable inventory={inventory} onRefresh={fetchData} />
              )}
            </TabsContent>

            <TabsContent value="cash">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : (
                <CashTable cash={cash} onRefresh={fetchData} />
              )}
            </TabsContent>

            <TabsContent value="debt">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : (
                <DebtTable debts={debts} onRefresh={fetchData} />
              )}
            </TabsContent>

            <TabsContent value="receivable">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : (
                <ReceivableTable receivables={receivables} onRefresh={fetchData} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
