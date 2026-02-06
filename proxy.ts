import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

// UBAH: Nama fungsi diganti dari 'middleware' menjadi 'proxy' 
// agar sesuai dengan konvensi file proxy.ts di Next.js 16
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}