'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ReportProductTableProps {
  data: {
    id: string
    name: string
    totalSold: number
    totalRevenue: number
    hppInvoice: number
    totalProfit: number
  }[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function ReportProductTable({ data }: ReportProductTableProps) {
  const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0)
  const totalHppInvoice = data.reduce((sum, item) => sum + item.hppInvoice, 0)
  const totalProfit = data.reduce((sum, item) => sum + item.totalProfit, 0)
  const totalSold = data.reduce((sum, item) => sum + item.totalSold, 0)

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead>Produk</TableHead>
            <TableHead className="text-right">Qty Terjual</TableHead>
            <TableHead className="text-right">Pendapatan</TableHead>
            <TableHead className="text-right">HPP Invoice</TableHead>
            <TableHead className="text-right">Profit Bersih</TableHead>
            <TableHead className="text-right">Profit Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((product, index) => {
            const margin = product.totalRevenue > 0 
              ? (product.totalProfit / product.totalRevenue) * 100 
              : 0
            return (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-right">{product.totalSold}</TableCell>
                <TableCell className="text-right">{formatCurrency(product.totalRevenue)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(product.hppInvoice)}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-medium",
                  product.totalProfit >= 0 ? "text-green-600" : "text-destructive"
                )}>
                  {formatCurrency(product.totalProfit)}
                </TableCell>
                <TableCell className={cn(
                  "text-right",
                  margin >= 20 ? "text-green-600" : margin >= 10 ? "text-yellow-600" : "text-destructive"
                )}>
                  {margin.toFixed(1)}%
                </TableCell>
              </TableRow>
            )
          })}
          {data.length > 0 && (
            <TableRow className="bg-muted/50 font-medium">
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right">{totalSold}</TableCell>
              <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(totalHppInvoice)}
              </TableCell>
              <TableCell className={cn(
                "text-right",
                totalProfit >= 0 ? "text-green-600" : "text-destructive"
              )}>
                {formatCurrency(totalProfit)}
              </TableCell>
              <TableCell className="text-right">
                {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
