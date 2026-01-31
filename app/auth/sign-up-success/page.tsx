import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Terima kasih telah mendaftar!
              </CardTitle>
              <CardDescription>Periksa email Anda untuk konfirmasi</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Anda telah berhasil mendaftar. Silakan periksa email Anda untuk
                mengkonfirmasi akun sebelum masuk.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
