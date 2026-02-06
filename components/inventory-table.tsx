'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Plus, Minus, AlertTriangle } from 'lucide-react'
import type { InventoryItem } from '@/lib/types'
import { EditInventoryDialog } from '@/components/edit-inventory-dialog'
import { StockAdjustmentDialog } from '@/components/stock-adjustment-dialog'
import { cn } from '@/lib/utils'

interface InventoryTableProps {
  inventory: InventoryItem[]
  onRefresh: () => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function InventoryTable({ inventory, onRefresh }: InventoryTableProps) {
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out'>('in')
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('inventory').delete().eq('id', id)
    onRefresh()
    router.refresh()
  }

  const openStockIn = (item: InventoryItem) => {
    setAdjustingItem(item)
    setAdjustmentType('in')
  }

  const openStockOut = (item: InventoryItem) => {
    setAdjustingItem(item)
    setAdjustmentType('out')
  }

  if (inventory.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground">Belum ada data inventaris</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Satuan</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right">Min. Stok</TableHead>
              <TableHead className="text-right">Harga Satuan</TableHead>
              <TableHead className="text-right">Nilai</TableHead>
              <TableHead className="w-[180px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => {
              const isLowStock = item.quantity <= item.min_quantity
              const isOutOfStock = item.quantity === 0
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.name}
                      {isOutOfStock && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                          Habis
                        </span>
                      )}
                      {!isOutOfStock && isLowStock && (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className={cn(
                    "text-right font-medium",
                    isOutOfStock && "text-destructive",
                    !isOutOfStock && isLowStock && "text-yellow-600"
                  )}>
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right">{item.min_quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.quantity * item.unit_cost)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openStockIn(item)}
                        title="Stok Masuk"
                      >
                        <Plus className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openStockOut(item)}
                        title="Stok Keluar"
                      >
                        <Minus className="h-4 w-4 text-red-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingItem(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Barang?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Barang &quot;{item.name}&quot; akan dihapus permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)}>
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <EditInventoryDialog
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        onSuccess={onRefresh}
      />

      <StockAdjustmentDialog
        item={adjustingItem}
        type={adjustmentType}
        open={!!adjustingItem}
        onOpenChange={(open) => !open && setAdjustingItem(null)}
        onSuccess={onRefresh}
      />
    </>
  )
}
