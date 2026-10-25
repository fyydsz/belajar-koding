# 📡 Dokumentasi REST API Belajar Koding (SIAKAD & LMS)

Dokumentasi ini menyediakan spesifikasi lengkap antarmuka pemrograman aplikasi (RESTful API) platform **Belajar Koding**. Server API dibangun di atas runtime **Bun** dan framework **ElysiaJS**, menyediakan autentikasi berbasis Better-Auth dengan cookie `HttpOnly`, manajemen kurikulum dan kelas (LMS), sistem presensi berkode OTP, rekapitulasi nilai akademik SIAKAD berbobot dinamis, utilitas unggah berkas presigned URL langsung ke Supabase Storage, serta webhook integrasi bot Discord.

Dokumen ini disinkronisasikan 100% dengan [DATABASE.md](file:///c:/Users/Fyy/Documents/Comission/Project/Web/belajar-koding/DATABASE.md) dan [ARCHITECTURE.md](file:///c:/Users/Fyy/Documents/Comission/Project/Web/belajar-koding/ARCHITECTURE.md).

---

## 1. Konvensi Umum API

- **Base URL Server**: `http://localhost:3001` (Development) / `https://api.belajarkoding.com` (Production)
- **Format Payload**: Standar penamaan properti JSON adalah **100% `camelCase`** (`studentId`, `batchCourseId`, `paymentProofUrl`). Drizzle ORM memetakan secara transparan ke format `snake_case` di basis data.
- **Mekanisme Autentikasi**:
  - **Sesi Web Browser (Rekomendasi)**: Cookie terproteksi `HttpOnly; Secure; SameSite=Lax` yang diterbitkan otomatis oleh Better-Auth.
  - **Bearer Token**: Header `Authorization: Bearer <accessToken>`.
  - **Discord Bot Webhook**: Header `X-Bot-Secret: <DISCORD_BOT_SECRET>`.

### 1.1. Standar Pagination, Filtering & Error Codes

#### A. Format Pagination Standar (Untuk Endpoint Koleksi / List)
Seluruh endpoint koleksi (`GET /v1/profile/users`, `GET /v1/batches`, `GET /v1/assignments`) mendukung parameter kueri (*query parameters*):
- `page` (integer, default: `1`): Nomor halaman aktif.
- `limit` (integer, default: `20`, maksimum: `100`): Jumlah data per halaman.
- `search` (string, opsional): Kata kunci pencarian.

**Format Respons Berpaginasi**:
```json
{
  "success": true,
  "message": "Data berhasil diambil.",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 145,
    "totalPages": 8,
    "hasNextPage": true
  }
}
```

#### B. Standar Kode Error Terstruktur (`errorCode`)
Setiap kegagalan respons menyertakan kode status HTTP semantik, pesan yang dapat dibaca manusia (`message`), serta konstanta `errorCode` terprogram:

```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Input data tidak valid.",
  "errors": [
    { "field": "email", "message": "Format email tidak valid" }
  ]
}
```

**Daftar `errorCode` Standar**:
| `errorCode` | Status HTTP | Deskripsi |
| :--- | :---: | :--- |
| `UNAUTHORIZED` | `401` | Sesi tidak ditemukan atau token kedaluwarsa. |
| `FORBIDDEN_ROLE` | `403` | Peran pengguna tidak memiliki hak akses rute. |
| `RESOURCE_NOT_FOUND` | `404` | Entitas data target tidak ditemukan. |
| `QUOTA_EXCEEDED` | `400` | Kapasitas kursi batch kelas telah penuh. |
| `TOKEN_EXPIRED` | `400` | Token presensi OTP atau kode pairing Discord telah kedaluwarsa. |
| `DUPLICATE_ENTRY` | `400` | Data sudah terdaftar (misal: presensi ganda, email terdaftar). |
| `RATE_LIMIT_EXCEEDED`| `429` | Batas maksimum laju request per menit terlampaui. |
| `VALIDATION_ERROR` | `400` | Payload request tidak memenuhi skema TypeBox. |

---

## 2. Diagram Alur Autentikasi & Validasi Sesi

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (Browser)
    participant Client as Frontend Next.js (App Router)
    participant Server as Elysia API Server (Port 3001)
    participant BetterAuth as Better-Auth Engine
    participant DB as PostgreSQL Database

    User->>Client: Input Email & Kata Sandi
    Client->>Server: POST /v1/auth/login { email, password }
    Server->>BetterAuth: signInEmail({ email, password })
    BetterAuth->>DB: Query tabel user & verifikasi password hash
    DB-->>BetterAuth: Kredensial valid
    BetterAuth->>DB: INSERT INTO session (token, expires_at, user_id)
    DB-->>BetterAuth: Sesi tersimpan
    BetterAuth-->>Server: Token Sesi Terbit
    Server->>DB: SELECT FROM profiles WHERE id = user.id
    DB-->>Server: Profil akademis & biodata
    Server-->>Client: 200 OK + Set-Cookie: HttpOnly; Secure; SameSite=Lax<br/>JSON { success: true, user, profile, session }
    Client->>Client: Simpan cache visual profil (Non-Sensitif)

    note over Client, Server: Request Rute Sensitif (Contoh: /dashboard/admin)
    Client->>Server: GET /v1/auth/me (Cookie HttpOnly disertakan otomatis)
    Server->>BetterAuth: getSession({ headers })
    BetterAuth->>DB: Validasi token & masa berlaku sesi
    alt Sesi Valid & Role = 'admin'
        DB-->>BetterAuth: Sesi aktif
        Server-->>Client: 200 OK { success: true, data: { user, profile } }
        Client->>User: Render Halaman Dashboard Admin
    else Role Bukan 'admin'
        Server-->>Client: 403 Forbidden { success: false, errorCode: "FORBIDDEN_ROLE" }
        Client->>User: Tampilkan Akses Ditolak / Redirect
    else Sesi Kedaluwarsa / Manipulasi Cookie
        Server-->>Client: 401 Unauthorized { success: false, errorCode: "UNAUTHORIZED" }
        Client->>User: Redirect ke Form Login
    end
```

---

## 3. Modul Sistem & Utilitas

### 3.1. Health Check
- **Title & Description**: Pemeriksaan kesiapan dan status operasional server backend.
- **Method & Endpoint**: `GET /health`
- **Authentication**: Public (Tanpa autentikasi)
- **Response**:
  - `200 OK`:
    ```json
    {
      "status": "ok",
      "service": "belajar-koding-server",
      "timestamp": "2026-10-24T18:00:00.000Z"
    }
    ```

---

## 4. Modul Autentikasi (`/v1/auth`)

### 4.1. Register Pengguna Baru
- **Title & Description**: Mendaftarkan akun siswa baru ke dalam sistem dan membuat record profil otomatis.
- **Method & Endpoint**: `POST /v1/auth/register`
- **Authentication**: Public
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "ahmad@example.com",
    "password": "Password123!",
    "fullName": "Ahmad Fauzi"
  }
  ```
  *Validasi Field*:
  - `email`: string, format email valid.
  - `password`: string, panjang minimal 6 karakter.
  - `fullName`: string, panjang antara 2 hingga 60 karakter.
- **Response**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Pendaftaran berhasil.",
      "data": {
        "user": {
          "id": "usr_948f2b71",
          "email": "ahmad@example.com",
          "fullName": "Ahmad Fauzi",
          "role": "student"
        },
        "session": {
          "accessToken": "b3tt3r_4uth_s3ss10n_t0k3n",
          "expiresIn": 604800
        }
      }
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "DUPLICATE_ENTRY",
      "message": "Email sudah terdaftar dalam sistem."
    }
    ```

### 4.2. Login Pengguna
- **Title & Description**: Masuk ke sistem menggunakan kredensial email dan password. Mengirimkan cookie `HttpOnly`.
- **Method & Endpoint**: `POST /v1/auth/login`
- **Authentication**: Public
- **Request Body**:
  ```json
  {
    "email": "ahmad@example.com",
    "password": "Password123!"
  }
  ```
- **Response**:
  - `200 OK` (dengan header `Set-Cookie: better-auth.session_token=...; HttpOnly; Secure; SameSite=Lax`):
    ```json
    {
      "success": true,
      "message": "Login berhasil.",
      "data": {
        "user": {
          "id": "usr_948f2b71",
          "email": "ahmad@example.com",
          "fullName": "Ahmad Fauzi",
          "role": "student",
          "avatarUrl": null
        },
        "profile": {
          "id": "usr_948f2b71",
          "fullName": "Ahmad Fauzi",
          "avatarUrl": null,
          "nim": null,
          "phoneNumber": null
        },
        "session": {
          "accessToken": "b3tt3r_4uth_s3ss10n_t0k3n",
          "expiresIn": 604800
        }
      }
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "success": false,
      "errorCode": "UNAUTHORIZED",
      "message": "Email atau kata sandi tidak valid."
    }
    ```

### 4.3. Mendapatkan Identitas Diri (`/me`)
- **Title & Description**: Mengambil informasi akun dan profil pengguna dari sesi yang sedang aktif.
- **Method & Endpoint**: `GET /v1/auth/me`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "id": "usr_948f2b71",
        "email": "ahmad@example.com",
        "fullName": "Ahmad Fauzi",
        "role": "student",
        "avatarUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/avatars/avatar.jpg",
        "emailConfirmedAt": "2026-09-20T10:00:00.000Z",
        "profile": {
          "id": "usr_948f2b71",
          "fullName": "Ahmad Fauzi",
          "nim": "202600109",
          "phoneNumber": "081234567890",
          "avatarUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/avatars/avatar.jpg"
        }
      }
    }
    ```

### 4.4. Logout Sesi
- **Title & Description**: Menghancurkan sesi login aktif di basis data dan membersihkan cookie.
- **Method & Endpoint**: `POST /v1/auth/logout`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Berhasil keluar."
    }
    ```

### 4.5. Ubah Kata Sandi (Revisi Keamanan & Anti-Account Takeover)
- **Title & Description**: Memperbarui kata sandi akun pengguna. Wajib menyertakan kata sandi saat ini untuk mencegah pengambilalihan akun.
- **Method & Endpoint**: `PATCH /v1/auth/password`
- **Authentication**: Session Cookie / Bearer Token
- **Request Body**:
  ```json
  {
    "currentPassword": "PasswordLama123!",
    "newPassword": "PasswordBaru2026!",
    "revokeOtherSessions": true
  }
  ```
  *Validasi Field*:
  - `currentPassword`: Wajib diisi string minimal 1 karakter.
  - `newPassword`: String minimal 6 karakter.
  - `revokeOtherSessions`: Boolean opsional (default: `true`), mencabut semua sesi aktif di perangkat lain.
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Kata sandi berhasil diperbarui."
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "VALIDATION_ERROR",
      "message": "Kata sandi saat ini tidak cocok atau format kata sandi baru tidak memenuhi syarat."
    }
    ```

### 4.6. Kirim Ulang Email Verifikasi
- **Title & Description**: Mengirimkan kembali tautan verifikasi ke alamat email akun.
- **Method & Endpoint**: `POST /v1/auth/resend-verification`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Email verifikasi berhasil dikirim ulang."
    }
    ```

---

## 5. Modul Profil & Manajemen Pengguna (`/v1/profile`)

### 5.1. Update Profil Siswa
- **Title & Description**: Memperbarui nama lengkap dan/atau URL foto avatar profil.
- **Method & Endpoint**: `PATCH /v1/profile`
- **Authentication**: Session Cookie / Bearer Token
- **Request Body**:
  ```json
  {
    "fullName": "Ahmad Fauzi S.Kom",
    "avatarUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/avatars/avatar.jpg"
  }
  ```
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Profil berhasil diperbarui.",
      "data": { ... }
    }
    ```

### 5.2. Status Penautan Discord
- **Title & Description**: Mengecek apakah akun Discord sudah terhubung serta melihat kode pairing yang masih aktif.
- **Method & Endpoint**: `GET /v1/profile/discord/status`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "isLinked": true,
        "discordId": "384918239102938102",
        "discordUsername": "ahmad_fauzi",
        "activeCode": "KF-8J2N",
        "expiresAt": "2026-10-24T18:20:00.000Z"
      }
    }
    ```

### 5.3. Generate Kode Pairing Discord
- **Title & Description**: Menghasilkan kode tautan Discord 6 digit unik (format `KF-XXXX`) dengan masa berlaku 15 menit.
- **Method & Endpoint**: `POST /v1/profile/discord/generate-code`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Kode tautan Discord berhasil dibuat.",
      "data": {
        "code": "KF-7L9P",
        "expiresAt": "2026-10-24T18:15:00.000Z"
      }
    }
    ```

### 5.4. Putuskan Tautan Discord
- **Title & Description**: Menghapus koneksi akun Discord dari akun pengguna.
- **Method & Endpoint**: `POST /v1/profile/unlink-discord`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Tautan akun Discord berhasil diputuskan."
    }
    ```

### 5.5. (Admin) Daftar Semua Pengguna (Berpaginasi)
- **Title & Description**: Menampilkan seluruh pengguna terdaftar dengan pagination dan filter pencarian.
- **Method & Endpoint**: `GET /v1/profile/users`
- **Authentication**: Session Cookie / Bearer Token (Role: `admin`)
- **Query Parameters**:
  - `page` (integer, default: `1`)
  - `limit` (integer, default: `20`, max: `100`)
  - `search` (string, opsional)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "usr_001",
          "fullName": "Administrator SIAKAD",
          "email": "admin@belajarkoding.com",
          "role": "admin",
          "avatarUrl": null,
          "discordId": null,
          "discordUsername": null,
          "createdAt": "2026-09-01T00:00:00.000Z"
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "totalItems": 1,
        "totalPages": 1,
        "hasNextPage": false
      }
    }
    ```
  - `403 Forbidden`:
    ```json
    {
      "success": false,
      "errorCode": "FORBIDDEN_ROLE",
      "message": "Hanya Administrator yang dapat mengelola pengguna."
    }
    ```

### 5.6. (Admin) Ubah Peran Pengguna
- **Title & Description**: Mengubah hak akses peran akun pengguna (`student`, `mentor`, `admin`).
- **Method & Endpoint**: `PATCH /v1/profile/users/:userId/role`
- **Authentication**: Session Cookie / Bearer Token (Role: `admin`)
- **Request Body**:
  ```json
  {
    "role": "mentor"
  }
  ```
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Peran pengguna berhasil diperbarui menjadi Mentor.",
      "data": { ... }
    }
    ```

---

## 6. Modul Batch & Pendaftaran Kelas (`/v1/batches`)

### 6.1. Ambil Daftar Semua Batch (Berpaginasi)
- **Title & Description**: Menampilkan seluruh batch kelas aktif beserta relasi kurikulum, mentor, harga, rekening pembayaran, dan kuota.
- **Method & Endpoint**: `GET /v1/batches`
- **Authentication**: Session Cookie / Bearer Token
- **Query Parameters**:
  - `page` (integer, default: `1`)
  - `limit` (integer, default: `20`)
  - `search` (string, opsional)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "019283a1-4567-789a-bcde-f0123456789a",
          "code": "BK-2026-FS1",
          "name": "Fullstack Batch 1 - 2026",
          "description": "Program intensif 16 sesi fullstack development.",
          "price": "1500000",
          "paymentAccountInfo": "Bank BCA 1234567890 a.n Belajar Koding",
          "maxStudents": 30,
          "studentCount": 18,
          "status": "active",
          "courseTitle": "Full-Stack Web Development",
          "mentorName": "Budi Santoso, M.Kom."
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "totalItems": 1,
        "totalPages": 1,
        "hasNextPage": false
      }
    }
    ```

### 6.2. Ambil Batch Saya (`/my-batches`)
- **Title & Description**: Menampilkan batch di mana pengguna terdaftar sebagai mahasiswa aktif/pending atau ditugaskan sebagai mentor.
- **Method & Endpoint**: `GET /v1/batches/my-batches`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [ ... ]
    }
    ```

### 6.3. Mendaftar Mandiri ke Batch
- **Title & Description**: Siswa mengajukan pendaftaran ke batch kelas dengan melampirkan bukti transfer. Mencatat transaksi audit ke tabel `enrollment_payments`.
- **Method & Endpoint**: `POST /v1/batches/:batchId/register`
- **Authentication**: Session Cookie / Bearer Token (Role: `student`)
- **Request Body**:
  ```json
  {
    "paymentProofUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/payments/usr_1/bukti.jpg",
    "notes": "Pembayaran via transfer m-BCA a.n Ahmad Fauzi"
  }
  ```
- **Response**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Pendaftaran batch berhasil diajukan dan sedang menunggu verifikasi pembayaran."
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "QUOTA_EXCEEDED",
      "message": "Kuota batch kelas ini telah penuh."
    }
    ```

### 6.4. (Mentor/Admin) Verifikasi Pendaftaran: Setujui (Approve)
- **Title & Description**: Menyetujui pendaftaran siswa (status enrollment menjadi `active` dan membuka akses materi kelas).
- **Method & Endpoint**: `PUT /v1/batches/enrollments/:enrollmentId/approve`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Pendaftaran batch berhasil disetujui. Akses materi kelas mahasiswa telah terbuka.",
      "data": { ... }
    }
    ```

### 6.5. (Mentor/Admin) Verifikasi Pendaftaran: Tolak (Reject)
- **Title & Description**: Menolak pendaftaran siswa dengan mencantumkan alasan penolakan pada log audit pembayaran.
- **Method & Endpoint**: `PUT /v1/batches/enrollments/:enrollmentId/reject`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Request Body**:
  ```json
  {
    "reason": "Bukti transfer tidak terbaca atau nominal tidak sesuai."
  }
  ```
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Pendaftaran batch telah ditolak.",
      "data": { ... }
    }
    ```

### 6.6. (Mentor/Admin) Buat Batch Baru
- **Title & Description**: Menerbitkan batch kelas baru dengan dukungan multi-mata kuliah dan multi-mentor melalui tabel pivot `batch_courses` dan `batch_mentors`.
- **Method & Endpoint**: `POST /v1/batches`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Request Body**:
  ```json
  {
    "name": "Fullstack Batch 2 - 2026",
    "description": "Kelas malam untuk profesional dan mahasiswa.",
    "price": 1750000,
    "paymentAccountInfo": "Bank Mandiri 1400012345678 a.n Belajar Koding",
    "maxStudents": 35,
    "courseIds": ["019283a1-0000-7000-8000-000000000001"],
    "mentorIds": ["usr_mentor_1", "usr_mentor_2"],
    "startDate": "2026-11-01T00:00:00.000Z",
    "endDate": "2027-02-28T00:00:00.000Z"
  }
  ```
- **Response**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Batch kelas berhasil dibuat.",
      "data": {
        "id": "019283a1-batch-uuid",
        "name": "Fullstack Batch 2 - 2026",
        "status": "upcoming"
      }
    }
    ```

---

## 7. Modul Kurikulum & Materi Perkuliahan (`/v1/classroom`)

### 7.1. Ambil Daftar Mata Kuliah
- **Title & Description**: Mengambil daftar kurikulum mata kuliah. Bagi siswa, menerapkan *enrollment gate* (hanya menampilkan mata kuliah yang terdaftar aktif) serta status kuncian sesi.
- **Method & Endpoint**: `GET /v1/classroom/courses`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "019283a1-course-uuid",
          "slug": "fullstack-web",
          "title": "Full-Stack Web Development",
          "totalSessions": 16,
          "sessions": [
            {
              "id": "sess_1",
              "sessionNumber": 1,
              "title": "Pertemuan 1: Fondasi Web & Lingkungan Kerja"
            }
          ]
        }
      ]
    }
    ```

### 7.2. Ambil Konten Sesi Pertemuan (MDX)
- **Title & Description**: Mengambil bahan ajar MDX dinamis, slide pendukung, dan tugas terkait untuk sesi pertemuan tertentu.
- **Method & Endpoint**: `GET /v1/classroom/courses/:slug/sessions/:sessionNumber`
- **Authentication**: Session Cookie / Bearer Token
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "session": {
          "id": "sess_uuid",
          "sessionNumber": 1,
          "title": "Pertemuan 1: Fondasi Web & Lingkungan Kerja"
        },
        "materials": [
          {
            "id": "mat_uuid",
            "title": "Pengantar Arsitektur Klien-Server",
            "contentMdx": "# Pengantar HTTP & REST\n\nKomunikasi data...",
            "fileUrl": null,
            "orderIndex": 1
          }
        ],
        "assignments": [ ... ]
      }
    }
    ```
  - `403 Forbidden`:
    ```json
    {
      "success": false,
      "errorCode": "FORBIDDEN_ROLE",
      "message": "Pertemuan ini belum dibuka oleh mentor untuk kelas Anda."
    }
    ```

### 7.3. (Mentor/Admin) Tambah Materi Pembelajaran ke Sesi
- **Title & Description**: Menyisipkan berkas dokumen/slide materi pembelajaran baru pada sesi pertemuan di basis data.
- **Method & Endpoint**: `POST /v1/classroom/sessions/:sessionId/materials`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Request Body**:
  ```json
  {
    "title": "Slide Arsitektur Database & Drizzle ORM",
    "contentMdx": "# Materi Sesi 2\n\nPelajari relasi tabel berikut...",
    "fileUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/materials/slide-sesi-2.pdf",
    "orderIndex": 1
  }
  ```
- **Response**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Materi pembelajaran berhasil ditambahkan.",
      "data": { ... }
    }
    ```

---

## 8. Modul Presensi Token OTP (`/v1/attendance`)

### 8.1. (Mentor/Admin) Buka Sesi Presensi Baru
- **Title & Description**: Membuka sesi presensi pertemuan kelas dengan token OTP 6 digit acak dan batas waktu kedaluwarsa (default 30 menit).
- **Method & Endpoint**: `POST /v1/attendance/open`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Request Body**:
  ```json
  {
    "batchId": "019283a1-batch-uuid",
    "sessionNumber": 3,
    "durationMinutes": 30
  }
  ```
- **Response**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Sesi presensi pertemuan 3 dibuka. Berlaku selama 30 menit.",
      "data": {
        "sessionId": "019283a1-sess-uuid",
        "tokenCode": "9K3M7L",
        "sessionNumber": 3,
        "expiresAt": "2026-10-24T18:30:00.000Z"
      }
    }
    ```

### 8.2. (Siswa) Input Kode Presensi (Web Check-In)
- **Title & Description**: Mahasiswa memasukkan kode token 6 digit untuk mencatat kehadiran. Dibatasi oleh rate limiter (maksimal 5 request / 5 menit).
- **Method & Endpoint**: `POST /v1/attendance/submit`
- **Authentication**: Session Cookie / Bearer Token (Role: `student`)
- **Request Body**:
  ```json
  {
    "code": "9K3M7L"
  }
  ```
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Kehadiran untuk Pertemuan 3 berhasil dicatat.",
      "data": {
        "sessionNumber": 3,
        "checkedInAt": "2026-10-24T18:05:12.000Z"
      }
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "TOKEN_EXPIRED",
      "message": "Kode presensi tidak valid atau waktu presensi telah berakhir."
    }
    ```
  - `429 Too Many Requests`:
    ```json
    {
      "success": false,
      "errorCode": "RATE_LIMIT_EXCEEDED",
      "message": "Terlalu banyak percobaan presensi yang salah. Silakan coba lagi dalam 5 menit."
    }
    ```

### 8.3. (Mentor/Admin) Matriks Rekapitulasi Presensi Batch
- **Title & Description**: Mengambil matriks kehadiran seluruh mahasiswa dari sesi 1 hingga 16 dalam satu batch.
- **Method & Endpoint**: `GET /v1/attendance/recap/:batchId`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "batch": { ... },
        "students": [
          {
            "studentId": "usr_1",
            "studentName": "Ahmad Fauzi",
            "attendance": {
              "1": { "status": "present", "checkedInAt": "..." }
            },
            "totalPresent": 15,
            "percentage": 93.75
          }
        ]
      }
    }
    ```

---

## 9. Modul Penugasan & Penilaian SIAKAD (`/v1/assignments` & `/v1/grades`)

### 9.1.A. Mengambil Daftar Tugas (Berpaginasi)
- **Title & Description**: Menampilkan seluruh tugas akademik beserta status pengerjaan siswa yang sedang login.
- **Method & Endpoint**: `GET /v1/assignments`
- **Authentication**: Session Cookie / Bearer Token
- **Query Parameters**:
  - `batchId` (string, opsional)
  - `type` (string, opsional: `'tugas'` | `'quiz'` | `'uts'` | `'uas'`)
  - `page` (integer, default: `1`)
  - `limit` (integer, default: `20`)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "019283a1-assign-uuid",
          "title": "UTS Proyek: Fullstack REST API SIAKAD",
          "type": "uts",
          "expiredAt": "2026-10-31T23:59:59.000Z",
          "isSubmitted": true,
          "submission": {
            "submittedAt": "2026-10-24T15:00:00.000Z",
            "grade": "92.50",
            "feedback": "Implementasi endpoint dan Drizzle ORM sangat rapi."
          }
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "totalItems": 1,
        "totalPages": 1,
        "hasNextPage": false
      }
    }
    ```

### 9.1.B. (Mentor/Admin) Buat Tugas / Evaluasi Baru
- **Title & Description**: Mentor menerbitkan tugas, kuis, UTS, atau UAS baru untuk suatu sesi pertemuan atau batch.
- **Method & Endpoint**: `POST /v1/assignments`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Request Body**:
  ```json
  {
    "batchCourseId": "019283a1-bc-uuid",
    "sessionId": "019283a1-sess-uuid",
    "type": "tugas",
    "title": "Tugas 1: Implementasi Skema Drizzle ORM",
    "description": "Buatlah skema relasional lengkap beserta indeksnya.",
    "expiredAt": "2026-10-30T23:59:59.000Z"
  }
  ```
- **Response**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Penugasan proyek berhasil dibuat.",
      "data": {
        "id": "019283a1-assign-uuid",
        "title": "Tugas 1: Implementasi Skema Drizzle ORM",
        "type": "tugas",
        "expiredAt": "2026-10-30T23:59:59.000Z"
      }
    }
    ```

### 9.1.C. (Mentor/Admin) Ambil Daftar Submisi Siswa per Tugas
- **Title & Description**: Menampilkan daftar seluruh siswa yang sudah mengumpulkan pada satu tugas tertentu untuk keperluan penilaian dosen.
- **Method & Endpoint**: `GET /v1/assignments/:assignmentId/submissions`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "019283a1-subm-uuid",
          "assignmentId": "019283a1-assign-uuid",
          "studentId": "usr_948f2b71",
          "studentName": "Ahmad Fauzi",
          "studentEmail": "ahmad@example.com",
          "submittedVia": "web",
          "repoUrl": "https://github.com/ahmadfauzi/siakad-api",
          "fileUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/submissions/usr_948f2b71/tugas.zip",
          "notes": "Unit test lulus 100%",
          "grade": null,
          "feedback": null,
          "submittedAt": "2026-10-24T15:00:00.000Z",
          "gradedAt": null
        }
      ]
    }
    ```

### 9.2. Pengumpulan Tugas (Submit / Re-submit)
- **Title & Description**: Siswa menyerahkan hasil pengerjaan tugas melalui repositori GitHub, URL demo, atau berkas file arsip.
- **Method & Endpoint**: `POST /v1/assignments/:id/submit`
- **Authentication**: Session Cookie / Bearer Token (Role: `student`)
- **Request Body**:
  ```json
  {
    "repoUrl": "https://github.com/ahmadfauzi/siakad-api",
    "demoUrl": "https://siakad-api.vercel.app",
    "fileUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/submissions/usr_1/archive.zip",
    "notes": "Telah melengkapi semua unit test di folder tests/"
  }
  ```
  *Validasi*: Minimal salah satu dari `repoUrl`, `demoUrl`, atau `fileUrl` wajib diisi.
- **Response**:
  - `201 Created` (Submisi pertama kali) / `200 OK` (Re-submit pembaruan):
    ```json
    {
      "success": true,
      "message": "Tugas berhasil dikumpulkan.",
      "data": { ... }
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "TOKEN_EXPIRED",
      "message": "Tenggat waktu pengumpulan tugas ini telah berakhir."
    }
    ```

### 9.3. (Mentor) Penilaian Tugas & Auto-Sync SIAKAD
- **Title & Description**: Mentor memberi nilai dan feedback pada submisi tugas mahasiswa. Sistem otomatis memicu kalkulasi ulang bobot nilai pada tabel `student_grades`.
- **Method & Endpoint**: `POST /v1/assignments/submissions/:id/grade`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Request Body**:
  ```json
  {
    "grade": 95,
    "feedback": "Pengerjaan sangat baik, arsitektur modular dan coverage unit test tinggi."
  }
  ```
  *Validasi*: `grade` angka antara 0 hingga 100.
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Nilai dan evaluasi berhasil disimpan serta disinkronkan ke transkrip nilai.",
      "data": {
        "id": "subm_uuid",
        "grade": "95.00",
        "feedback": "Pengerjaan sangat baik...",
        "gradedAt": "2026-10-24T18:10:00.000Z"
      }
    }
    ```

### 9.4. (Siswa) Transkrip KHS Mandiri (`/v1/grades/my`)
- **Title & Description**: Mengambil transkrip nilai akademik lengkap untuk seluruh mata kuliah yang ditempuh siswa.
- **Method & Endpoint**: `GET /v1/grades/my`
- **Authentication**: Session Cookie / Bearer Token (Role: `student`)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "gradeId": "019283a1-grade-uuid",
          "courseTitle": "Full-Stack Web Development",
          "tugas": 90.00,
          "quiz": 85.00,
          "uts": 92.00,
          "uas": 95.00,
          "evaluation": {
            "finalScore": 91.10,
            "gradeLetter": "A",
            "gradePoint": 4.0,
            "predicate": "Sangat Baik",
            "isPassing": true
          }
        }
      ]
    }
    ```

### 9.5. (Mentor/Admin) Rekapitulasi Nilai Batch
- **Title & Description**: Mengambil lembar nilai seluruh siswa pada suatu batch untuk keperluan yudisium.
- **Method & Endpoint**: `GET /v1/grades/batch/:batchId`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "batch": { ... },
        "students": [ ... ]
      }
    }
    ```

### 9.6. (Mentor/Admin) Override Nilai Akhir Siswa (Standardized camelCase)
- **Title & Description**: Melakukan intervensi nilai manual resmi untuk mahasiswa pada suatu batch/mata kuliah.
- **Method & Endpoint**: `POST /v1/grades/override`
- **Authentication**: Session Cookie / Bearer Token (Role: `mentor` | `admin`)
- **Request Body**:
  ```json
  {
    "studentId": "usr_948f2b71",
    "batchId": "019283a1-batch-uuid",
    "tugasScore": 85,
    "quizScore": 80,
    "utsScore": 88,
    "uasScore": 90,
    "finalScore": 92.5,
    "isOverride": true
  }
  ```
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Nilai override berhasil ditetapkan.",
      "data": {
        "evaluation": {
          "finalScore": 92.5,
          "gradeLetter": "A",
          "gradePoint": 4.0,
          "predicate": "Sangat Baik",
          "isPassing": true
        }
      }
    }
    ```

---

## 10. Modul Webhook Discord Bot (`/v1/bot`)

Seluruh endpoint di bawah ini diproteksi dengan header rahasia bot: `X-Bot-Secret`. Payload JSON telah distandardisasi menggunakan konvensi **`camelCase`** (dengan dukungan *fallback* otomatis untuk payload warisan `snake_case`).

### 10.1. Tautkan Akun Discord via Bot
- **Title & Description**: Menghubungkan akun Discord siswa dengan profil web Belajar Koding melalui kode pairing (`/tautkan <kode>`).
- **Method & Endpoint**: `POST /v1/bot/link-discord`
- **Authentication**: API Key / Header Secret (`X-Bot-Secret`)
- **Headers**:
  - `X-Bot-Secret: <DISCORD_BOT_SECRET>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "code": "KF-7L9P",
    "discordUserId": "384918239102938102",
    "discordUsername": "ahmad_fauzi"
  }
  ```
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Akun Discord @ahmad_fauzi berhasil ditautkan ke akun Ahmad Fauzi.",
      "data": {
        "studentName": "Ahmad Fauzi",
        "email": "ahmad@example.com",
        "discordUsername": "ahmad_fauzi"
      }
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "TOKEN_EXPIRED",
      "message": "Kode tautan tidak valid atau telah kedaluwarsa. Silakan buat kode baru di dashboard web."
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "success": false,
      "errorCode": "UNAUTHORIZED",
      "message": "Autentikasi bot gagal. Header X-Bot-Secret tidak valid atau tidak disertakan."
    }
    ```

### 10.2. Pengumpulan Tugas via Bot Discord
- **Title & Description**: Menerima penyerahan tugas mahasiswa dari bot Discord ke sistem LMS.
- **Method & Endpoint**: `POST /v1/bot/submission`
- **Authentication**: API Key / Header Secret (`X-Bot-Secret`)
- **Request Body**:
  ```json
  {
    "discordId": "384918239102938102",
    "assignmentId": "019283a1-assign-uuid",
    "fileUrl": "https://cdn.discordapp.com/attachments/123/tugas.zip",
    "repoUrl": "https://github.com/ahmadfauzi/tugas",
    "demoUrl": null,
    "notes": "Pengumpulan via bot Discord",
    "messageId": "119283918293819201",
    "channelId": "102938475610293847"
  }
  ```
  > [!NOTE]
  > **Penanganan Preservasi Berkas Discord CDN**: Karena tautan lampiran Discord CDN (`cdn.discordapp.com`) kedaluwarsa secara otomatis dalam 24 jam, worker Discord bot atau backend API disarankan melakukan proses *fetch & re-upload* berkas biner ke Supabase Storage bucket `submissions` sebelum menyimpan URL ke database, sehingga berkas tugas dapat diakses permanen oleh mentor saat penilaian.
- **Response**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "Tugas 'UTS Proyek' berhasil dikumpulkan oleh Ahmad Fauzi via Discord.",
      "data": { ... }
    }
    ```
  - `404 Not Found`:
    ```json
    {
      "success": false,
      "errorCode": "RESOURCE_NOT_FOUND",
      "message": "Siswa dengan Discord ID 384918239102938102 belum menautkan akun Discord di profil web Belajar Koding."
    }
    ```

### 10.3. Presensi Mahasiswa via Bot Discord
- **Title & Description**: Menerima input kode presensi mahasiswa dari perintah Discord `/presensi <kode>`.
- **Method & Endpoint**: `POST /v1/bot/attendance`
- **Authentication**: API Key / Header Secret (`X-Bot-Secret`)
- **Request Body**:
  ```json
  {
    "discordId": "384918239102938102",
    "code": "9K3M7L"
  }
  ```
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "✅ Presensi Pertemuan 3 berhasil dicatat atas nama Ahmad Fauzi!",
      "data": {
        "studentName": "Ahmad Fauzi",
        "sessionNumber": 3,
        "channel": "discord"
      }
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "TOKEN_EXPIRED",
      "message": "Kode presensi tidak valid atau waktu presensi telah berakhir."
    }
    ```

---

## 11. Modul Utilitas Penyimpanan & Presigned Upload (`/v1/storage`)

Modul ini menggantikan unggahan `multipart/form-data` konvensional yang membebani memori Bun. Klien meminta izin upload bertempo singkat (5 menit) ke Elysia, kemudian mengunggah file biner langsung ke Supabase Storage (*Direct-to-S3*).

### 11.1. Generate Presigned Upload URL
- **Title & Description**: Meminta URL unggah sementara bertanda tangan kriptografis untuk mengunggah berkas langsung ke bucket Supabase Storage.
- **Method & Endpoint**: `POST /v1/storage/presigned-url`
- **Authentication**: Session Cookie / Bearer Token
- **Request Body**:
  ```json
  {
    "bucket": "submissions",
    "fileName": "project-uts-ahmad.zip",
    "contentType": "application/zip",
    "fileSize": 15482910
  }
  ```
  *Validasi Field*:
  - `bucket`: Salah satu dari:
    - `'avatars'`: Maksimum 2MB (`image/jpeg`, `image/png`, `image/webp`).
    - `'payments'`: Maksimum 5MB (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
    - `'submissions'`: Maksimum 50MB (arsip `.zip`, `.rar`, `.7z`, `.tar.gz`, atau `.pdf`).
    - `'materials'`: Maksimum 25MB (`.pdf`, `.zip`, `.ppt`, `.pptx`).
  - `fileName`: String nama berkas asli (akan disanitasi dan diberi prefix UUIDv7 unik).
  - `contentType`: MIME type yang sesuai dengan daftar izin bucket.
  - `fileSize`: Integer ukuran file dalam byte.
- **Response**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Presigned upload URL berhasil dibuat.",
      "data": {
        "uploadUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/upload/sign/submissions/usr_948f2b71/019283a1-project-uts-ahmad.zip?token=...",
        "publicUrl": "https://rdexkpdikmuqhawuljjj.supabase.co/storage/v1/object/public/submissions/usr_948f2b71/019283a1-project-uts-ahmad.zip",
        "fileKey": "usr_948f2b71/019283a1-project-uts-ahmad.zip",
        "expiresIn": 300
      }
    }
    ```
  - `400 Bad Request`:
    ```json
    {
      "success": false,
      "errorCode": "VALIDATION_ERROR",
      "message": "Ukuran berkas melebihi batas maksimum 50MB untuk bucket 'submissions'."
    }
    ```
