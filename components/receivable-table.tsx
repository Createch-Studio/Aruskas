'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Search } from 'lucide-react'
import type { Receivable } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { AddReceivableDialog } from '@/components/add-receivable-dialog'
import { ReceivableStatusDropdown } from '@/components/receivable-status-dropdown'
import { useState } from 'react'

interface ReceivableTableProps {
  receivables: Receivable[]
  onRefresh: () => void
}

export function ReceivableTable({ receivables, onRefresh }: ReceivableTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Filter data berdasarkan nama debitur
  const filteredData = receivables.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama debitur..."
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Piutang
        </Button>
      </div>

      <AddReceivableDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
        onSuccess={onRefresh} 
      />

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Debitur</TableHead>
              <TableHead className="text-right">Total Piutang</TableHead>
              <TableHead className="text-right">Diterima</TableHead>
              <TableHead className="text-right">Sisa</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Data piutang tidak ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((receivable) => {
                if (!receivable.id) return null;

                const isOverdue = 
                  receivable.due_date && 
                  new Date(receivable.due_date) < new Date() && 
                  receivable.status !== 'paid'

                return (
                  <TableRow key={receivable.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="font-semibold">{receivable.name}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1 italic">
                        {receivable.description || 'Tanpa catatan'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(receivable.amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-mono text-sm">
                      {formatCurrency(receivable.amount - receivable.remaining_amount)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 font-mono text-sm">
                      {formatCurrency(receivable.remaining_amount)}
                    </TableCell>
                    <TableCell className={cn("text-xs", isOverdue && 'text-red-500 font-bold')}>
                      {receivable.due_date ? new Date(receivable.due_date).toLocaleDateString('id-ID') : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {/* Dropdown ini yang akan berisi query Supabase langsung */}
                      <ReceivableStatusDropdown receivable={receivable} onRefresh={onRefresh} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}