import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ProductTable } from '@/components/product-table'
import { AddProductDialog } from '@/components/add-product-dialog'
import { Box, Package } from 'lucide-react' // Menambah ikon untuk konsistensi
import type { Product } from '@/lib/types'

async function getProductsData(userId: string) {
  const supabase = await createClient()
  
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .order('name')

  return (products || []) as Product[]
}

export default async function ProdukPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const products = await getProductsData(user.id)
  const activeProducts = products.filter(p => p.is_active).length

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Produk</h1>
          <p className="text-muted-foreground">
            Kelola katalog menu, paket, atau jasa yang Anda tawarkan.
          </p>
        </div>
        <AddProductDialog />
      </div>

      {/* Ringkasan Statistik Cepat */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produk Aktif</CardTitle>
            <Box className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeProducts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Utama */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
          <CardDescription>
            Gunakan tabel di bawah untuk melihat, mengubah, atau menonaktifkan produk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductTable products={products} />
        </CardContent>
      </Card>
    </div>
  )
}