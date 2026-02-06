'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import type { Debt } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { AddDebtDialog } from '@/components/add-debt-dialog'
import { DebtStatusDropdown } from '@/components/debt-status-dropdown'
import { useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DebtTableProps {
  debts: Debt[]
  onRefresh: () => void
}

export function DebtTable({ debts, onRefresh }: DebtTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all')
  
  // State Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Logika Filter
  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'paid' ? d.status === 'paid' : 
        d.status !== 'paid' // unpaid
      
      return matchesSearch && matchesStatus
    })
  }, [debts, search, statusFilter])

  // Logika Pagination
  const totalPages = Math.ceil(filteredDebts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedDebts = filteredDebts.slice(startIndex, startIndex + itemsPerPage)

  // Reset ke halaman 1 jika filter berubah
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setCurrentPage(1)
  }

  const handleStatusChange = (val: string) => {
    setStatusFilter(val as any)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari kreditur..."
              className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 focus:ring-primary bg-white"
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          {/* Filter Status */}
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="unpaid">Belum Lunas</SelectItem>
              <SelectItem value="paid">Lunas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setAddDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Tambah Utang
        </Button>
      </div>

      <AddDebtDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={onRefresh} />

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Kreditur</TableHead>
              <TableHead className="text-right">Total Utang</TableHead>
              <TableHead className="text-right">Terbayar</TableHead>
              <TableHead className="text-right">Sisa</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead className="text-center w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDebts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                  Tidak ada data utang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              paginatedDebts.map((debt) => {
                if (!debt.id) return null

                const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && debt.status !== 'paid'
                const paidAmount = debt.amount - debt.remaining_amount
                
                return (
                  <TableRow key={debt.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-slate-900">{debt.name}</div>
                      {debt.description && (
                        <div className="text-[11px] text-muted-foreground italic line-clamp-1">
                          {debt.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(debt.amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-mono text-sm">
                      {formatCurrency(paidAmount)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600 font-mono text-sm">
                      {formatCurrency(debt.remaining_amount)}
                    </TableCell>
                    <TableCell className={cn("text-xs", isOverdue && 'text-red-500 font-bold')}>
                      {debt.due_date ? new Date(debt.due_date).toLocaleDateString('id-ID') : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <DebtStatusDropdown debt={debt} onRefresh={onRefresh} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">
            Menampilkan <span className="font-medium">{startIndex + 1}</span> sampai{' '}
            <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredDebts.length)}</span> dari{' '}
            <span className="font-medium">{filteredDebts.length}</span> data
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              Hal {currentPage} dari {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}