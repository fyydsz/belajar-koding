# Belajar Koding — Sistem Desain Dashboard (SIAKAD & LMS)

Dokumen ini menetapkan standar desain tunggal untuk seluruh halaman dashboard (**Siswa**, **Mentor**, dan **Admin**) agar konsisten, bersih, dan nyaman dilihat.

## 1. Tipografi
- **Font Utama**: `Geist` (`--font-sans`), dimuat tunggal melalui `src/app/layout.tsx`.
- **Hierarki Ukuran**:
  - Judul Halaman (`h1`): `text-2xl font-bold tracking-tight text-fd-foreground`
  - Subjudul Halaman: `text-sm text-fd-muted-foreground`
  - Judul Seksi / Kartu (`h2`, `CardTitle`): `text-base font-semibold text-fd-foreground`
  - Teks Isi / Tabel: `text-sm text-fd-foreground`
  - Label / Meta Sekunder: `text-xs font-medium text-fd-muted-foreground`
- **Aturan Teks**:
  - Bahasa antarmuka menggunakan **Bahasa Indonesia** secara konsisten.
  - Istilah pengguna diseragamkan menjadi **Siswa**, **Mentor**, dan **Admin**.
  - Dilarang menggunakan karakter em dash pada teks antarmuka; gunakan tanda titik tengah (`·`), tanda hubung (`-`), atau titik dua (`:`).

## 2. Sistem Warna & Token (`src/app/global.css`)
Token Shadcn (`--primary`, `--card`, `--border`, `--muted`) dan token Fumadocs (`--color-fd-*`) diselaraskan penuh:
- **Light Mode**:
  - Primary Accent: `#2563EB` (teks putih `#FFFFFF`)
  - Background: `hsl(0, 0%, 98%)`
  - Card Surface: `hsl(0, 0%, 100%)`
  - Border: `hsla(0, 0%, 0%, 0.09)`
- **Dark Mode**:
  - Primary Accent: `#38BDF8` (teks gelap `#090D16`)
  - Background: `hsl(0, 0%, 3%)`
  - Card Surface: `hsl(0, 0%, 5.5%)`
  - Border: `hsla(0, 0%, 100%, 0.1)`
- **Status Semantik**:
  - Sukses / Aktif / Hadir: `emerald` (`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`)
  - Peringatan / Menunggu / Izin: `amber` (`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`)
  - Bahaya / Ditolak / Alpha: `destructive` (`bg-destructive/10 text-destructive border-destructive/20`)

## 3. Tata Letak & Header Halaman
- **Lebar Kontainer**: Mengikuti kontainer utama `DashboardLayoutClient` (`max-w-5xl`). Halaman di dalam dashboard tidak boleh mempersempit kontainer utama menjadi `max-w-2xl` atau `max-w-4xl` agar garis tepi kiri dan kanan selalu sejajar saat berpindah menu.
- **Struktur Header Halaman**:
  - Setiap halaman diawali dengan `<header className="flex flex-col gap-4 border-b border-fd-border pb-5 sm:flex-row sm:items-end sm:justify-between">`.
  - Tanpa *eyebrow pill badge* dekoratif di atas `h1`.

## 4. Arsitektur Komponen
- **Kartu (Card)**: Satu lapis permukaan (`rounded-xl border border-fd-border bg-fd-card shadow-2xs`). Tidak menggunakan *double-bezel nested card*.
- **Tab Filter**: Segmented control seragam (`inline-flex items-center gap-1 rounded-xl bg-fd-muted/60 p-1 border border-fd-border/60`), dengan item aktif `bg-fd-card text-fd-foreground shadow-2xs`.
- **Modal & Konfirmasi**: Selalu menggunakan komponen `<Dialog>` dari `@/components/ui/dialog`, bukan overlay `fixed inset-0` manual atau `window.confirm()`.
- **Target Sentuh (Mobile)**: Tombol interaktif memiliki tinggi minimal `36px`-`40px` dan tidak boleh disembunyikan permanen di balik `opacity-0 group-hover:opacity-100` pada layar sentuh.
