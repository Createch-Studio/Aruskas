'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import type { Receivable } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { AddReceivableDialog } from '@/components/add-receivable-dialog'
import { ReceivableStatusDropdown } from '@/components/receivable-status-dropdown'
import { useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ReceivableTableProps {
  receivables: Receivable[]
  onRefresh: () => void
}

export function ReceivableTable({ receivables, onRefresh }: ReceivableTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all')
  
  // State Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Logika Filter: Gabungan Search & Status
  const filteredData = useMemo(() => {
    return receivables.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'paid' ? item.status === 'paid' : 
        item.status !== 'paid' // unpaid logic

      return matchesSearch && matchesStatus
    })
  }, [receivables, search, statusFilter])

  // Logika Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  // Reset ke halaman 1 jika filter berubah
  const handleFilterChange = (type: 'search' | 'status', value: string) => {
    if (type === 'search') setSearch(value)
    if (type === 'status') setStatusFilter(value as any)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama debitur..."
              className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-1 focus:ring-primary outline-none bg-white"
              value={search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(val) => handleFilterChange('status', val)}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Semua Status" />
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
              <TableHead className="w-[100px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                  Data piutang tidak ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((receivable) => {
                if (!receivable.id) return null;

                const isOverdue = 
                  receivable.due_date && 
                  new Date(receivable.due_date) < new Date() && 
                  receivable.status !== 'paid'

                return (
                  <TableRow key={receivable.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-slate-900">{receivable.name}</div>
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
                      <ReceivableStatusDropdown receivable={receivable} onRefresh={onRefresh} />
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
        <div className="flex items-center justify-between px-2 py-2">
          <div className="text-sm text-muted-foreground">
            Menampilkan <span className="font-medium">{startIndex + 1}</span> -{' '}
            <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredData.length)}</span>{' '}
            dari <span className="font-medium">{filteredData.length}</span> piutang
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Hal {currentPage} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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