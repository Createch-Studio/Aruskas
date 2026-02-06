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
import { Badge } from '@/components/ui/badge'
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
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { EditProductDialog } from '@/components/edit-product-dialog'
import type { Product } from '@/lib/types'

interface ProductTableProps {
  products: Product[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ProductTable({ products }: ProductTableProps) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null) // ID produk yang sedang diproses
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    setIsProcessing(id)
    try {
      await supabase.from('products').delete().eq('id', id)
      router.refresh()
    } finally {
      setIsProcessing(null)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const supabase = createClient()
    await supabase.from('products').update({ is_active: !isActive }).eq('id', id)
    router.refresh()
  }

  if (products.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground border rounded-lg border-dashed">
        Belum ada data produk
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">Nama Produk</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="text-right">Harga Jual</TableHead>
              <TableHead className="text-right">Packaging Cost</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[100px] text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-semibold text-primary">
                  {product.name}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                  {product.description || '-'}
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {formatCurrency(product.price)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(product.cost)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={product.is_active ? 'default' : 'secondary'}
                    className={`cursor-pointer transition-all hover:opacity-80 ${
                      product.is_active ? 'bg-green-500 hover:bg-green-600' : ''
                    }`}
                    onClick={() => handleToggleActive(product.id, product.is_active)}
                  >
                    {product.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isProcessing === product.id}
                        >
                          {isProcessing === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Hapus</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Menghapus produk dapat mempengaruhi data transaksi yang sudah ada.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(product.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditProductDialog
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
      />
    </>
  )
}