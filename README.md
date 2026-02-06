# 🚀 Aruskas - Integrated Business & Financial ERP

**Aruskas** adalah sistem manajemen keuangan dan operasional bisnis (ERP) terintegrasi yang dibangun untuk efisiensi pengelolaan kas, inventaris, hingga laporan penjualan. Aplikasi ini menyediakan solusi *all-in-one* mulai dari pencatatan harian hingga pembuatan invoice otomatis.

---

## ✨ Fitur Utama

### 📊 Dashboard & Laporan
* **Real-time Analytics**: Visualisasi grafik arus kas, laba rugi, dan tren penjualan.
* **Laporan Keuangan**: Laporan otomatis untuk pengeluaran, pemasukan, dan mutasi kas.

### 👥 Client & Penjualan (Sales)
* **Client Management**: Database klien untuk memudahkan tracking transaksi berulang.
* **Product Orders**: Pencatatan pesanan masuk dengan status pembayaran (Pending/Paid).
* **Invoice System**: Pembuatan invoice profesional untuk setiap transaksi penjualan maupun belanja.

### 💸 Keuangan & Pengeluaran
* **Multi-Account Cash**: Kelola Bank, Kas Kecil, dan E-Wallet secara terpisah.
* **Operasional**: Pencatatan biaya operasional seperti gaji, sewa, dan utilitas.
* **Utang & Piutang**: Sistem pengingat jatuh tempo dengan tracking sisa saldo pinjaman.

### 📦 Aset & Inventaris
* **Inventaris Barang**: Manajemen stok produk dengan histori masuk dan keluar barang.
* **Manajemen Aset**: Pencatatan aset tetap perusahaan (mesin, gedung, kendaraan) beserta nilai perolehannya.

---

## 🛠️ Arsitektur Teknologi

* **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
* **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
* **UI Components**: [Shadcn/UI](https://ui.shadcn.com/) & [Tailwind CSS](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Deployment**: [Vercel](https://vercel.com/)

---

Berikut adalah panduan instalasi lengkap untuk menjalankan proyek **Aruskas ERP** di komputer lokal Anda, mulai dari persiapan hingga aplikasi berjalan.

---

## 📋 Persiapan (Prerequisites)

Pastikan perangkat Anda sudah terinstal:

* **Node.js** (Versi 18 atau terbaru)
* **Package Manager**: `pnpm` (disarankan), `npm`, atau `yarn`.
* **Akun Supabase**: Untuk database dan autentikasi.

---

## 🛠️ Langkah-Langkah Instalasi

### 1. Clone Repository

Buka terminal atau CMD, lalu jalankan perintah berikut:

```bash
git clone https://github.com/Createch-Studio/Aruskas.git
cd Aruskas

```

### 2. Instal Dependensi

Gunakan `pnpm` untuk proses yang lebih cepat dan efisien:

```bash
pnpm install

```

*(Jika tidak punya pnpm, gunakan `npm install`)*

### 3. Konfigurasi Environment Variable

1. Buat file baru bernama **`.env.local`** di root folder (folder utama).
2. Dapatkan URL dan API Key dari Dashboard Supabase (**Project Settings > API**).
3. Isi file tersebut dengan format berikut:
```env
NEXT_PUBLIC_SUPABASE_URL=https://id-proyek-anda.supabase.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...

```



### 4. Setup Database di Supabase

Masuk ke **SQL Editor** di dashboard Supabase Anda, lalu tempel dan jalankan skema tabel (SQL) yang ada di file `README.md` (tabel `cash`, `transactions`, `products`, `sales`, `assets`, dll).

### 5. Jalankan Mode Pengembangan

Setelah semua siap, nyalakan server lokal:

```bash
pnpm dev

```

Aplikasi Anda sekarang aktif di: **`http://localhost:3000`**

---

## 🚀 Cara Menghubungkan ke Vercel (Deployment)

Jika Anda ingin aplikasi ini bisa diakses secara online:

1. Push kode Anda ke **GitHub**.
2. Masuk ke [Vercel](https://vercel.com/) dan buat **New Project**.
3. **Import** repository yang baru Anda push.
4. Pada bagian **Environment Variables**, masukkan kembali:
* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`


5. Klik **Deploy**. Selesai!

---

