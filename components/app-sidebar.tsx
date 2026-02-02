'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Receipt,
  Package,
  ShoppingCart,
  FileText,
  Users,
  ClipboardList,
  ShoppingBag,
  Boxes,
  Building2,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Client', href: '/dashboard/client', icon: Users },
  { name: 'Order', href: '/dashboard/order', icon: ShoppingBag },
  { name: 'Invoice Belanja', href: '/dashboard/invoice', icon: ClipboardList },
  { name: 'Pengeluaran', href: '/dashboard/pengeluaran', icon: Receipt },
  { name: 'Produk', href: '/dashboard/produk', icon: Package },
  { name: 'Inventaris', href: '/dashboard/inventaris', icon: Boxes },
  { name: 'Aset', href: '/dashboard/aset', icon: Building2 },
  { name: 'Penjualan', href: '/dashboard/penjualan', icon: ShoppingCart },
  { name: 'Laporan', href: '/dashboard/laporan', icon: FileText },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Receipt className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">AkunPro</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </aside>
  )
}
