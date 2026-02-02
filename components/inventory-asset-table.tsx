'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { InventoryItem } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface InventoryAssetTableProps {
  inventory: InventoryItem[]
  onRefresh: () => void
}

export function InventoryAssetTable({ inventory }: InventoryAssetTableProps) {
  if (inventory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Tidak ada barang inventaris
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Barang</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Harga Satuan</TableHead>
            <TableHead className="text-right">Total Nilai</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventory.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.name}</div>
                {item.description && (
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                )}
              </TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(item.quantity * item.unit_cost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
