import React from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import {
  LayoutDashboard,
  CalendarCheck,
  BookOpenCheck,
  GraduationCap,
  CheckSquare,
  User,
  ClipboardList,
  FileSpreadsheet,
  ShieldCheck,
  BookOpen,
  Layers,
  FileCode,
  ClipboardCheck,
} from 'lucide-react';

export interface CourseSessionNode {
  id: string;
  sessionNumber: number;
  title: string;
}

export interface ClassroomCourseItem {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  totalSessions: number;
  sessions?: CourseSessionNode[];
}

export function getDashboardTree(
  role?: string,
  classroomCourses: ClassroomCourseItem[] = []
): PageTree.Root {
  const isMentorOrAdmin = role === 'mentor' || role === 'admin';
  const isAdmin = role === 'admin';

  // Helper untuk membuat node folder kelas dan pertemuannya
  const createCourseNodes = (isMentor: boolean): PageTree.Node[] => {
    // Jika mahasiswa dan belum memiliki kelas yang terdaftar aktif, jangan tampilkan menu kelas
    if (!isMentor && (!classroomCourses || classroomCourses.length === 0)) {
      return [];
    }

    const mainPage: PageTree.Node = {
      type: 'page',
      name: isMentor ? 'Kelola Kelas & Materi' : 'Daftar Semua Kelas',
      url: isMentor ? '/dashboard/dosen/kelas' : '/dashboard/kelas',
      icon: <Layers className="size-4" />,
    };

    if (!classroomCourses || classroomCourses.length === 0) {
      return [mainPage];
    }

    const courseFolders: PageTree.Node[] = classroomCourses.map((course) => {
      const sessionChildren: PageTree.Node[] = (course.sessions || []).map((s) => {
        const cleanDetail = (s.title || '').replace(/^Pertemuan\s*\d+\s*[-:]*\s*/i, '').trim();
        const displayName = cleanDetail
          ? `P${s.sessionNumber}: ${cleanDetail}`
          : `Pertemuan ${s.sessionNumber}`;

        return {
          type: 'page',
          name: displayName,
          url: isMentor
            ? `/dashboard/dosen/kelas/${course.slug}?p=${s.sessionNumber}`
            : `/dashboard/kelas/${course.slug}?p=${s.sessionNumber}`,
          icon: (
            <FileCode className="shrink-0 size-4 text-fd-muted-foreground group-data-[active=true]:text-fd-primary transition-colors" />
          ),
        };
      });

      return {
        type: 'folder',
        name: course.title,
        defaultOpen: true,
        icon: <GraduationCap className="size-4 text-fd-primary" />,
        index: {
          type: 'page',
          name: 'Semua Pertemuan',
          url: isMentor
            ? `/dashboard/dosen/kelas/${course.slug}`
            : `/dashboard/kelas/${course.slug}`,
          icon: <BookOpen className="size-3.5" />,
        },
        children: sessionChildren,
      };
    });

    return [mainPage, ...courseFolders];
  };

  // 1. Menu Khusus Administrator (Memiliki Hak Akses Admin + Mentor)
  if (isAdmin) {
    const adminChildren: PageTree.Node[] = [
      {
        type: 'separator',
        name: 'Administrasi Sistem',
      },
      {
        type: 'page',
        name: 'Ringkasan Sistem',
        url: '/dashboard/admin',
        icon: <LayoutDashboard className="size-4" />,
      },
      {
        type: 'page',
        name: 'Kelola Batch & Siswa',
        url: '/dashboard/admin/batches',
        icon: <Layers className="size-4" />,
      },
      {
        type: 'page',
        name: 'Kelola Pengguna',
        url: '/dashboard/admin/pengguna',
        icon: <ShieldCheck className="size-4" />,
      },

      {
        type: 'separator',
        name: 'Manajemen Akademik',
      },
      {
        type: 'page',
        name: 'Buka & Rekap Presensi',
        url: '/dashboard/mentor/presensi',
        icon: <CalendarCheck className="size-4" />,
      },
      {
        type: 'page',
        name: 'Kelola Tugas & Proyek',
        url: '/dashboard/dosen/tugas',
        icon: <ClipboardList className="size-4" />,
      },
      {
        type: 'page',
        name: 'Rekap Nilai Siswa',
        url: '/dashboard/dosen/nilai',
        icon: <FileSpreadsheet className="size-4" />,
      },
      {
        type: 'page',
        name: 'Verifikasi Pendaftaran Batch',
        url: '/dashboard/dosen/verifikasi-batch',
        icon: <ClipboardCheck className="size-4" />,
      },

      {
        type: 'separator',
        name: 'Daftar Kelas & Kurikulum',
      },
      ...createCourseNodes(true),

      {
        type: 'separator',
        name: 'Pengaturan',
      },
      {
        type: 'page',
        name: 'Profil Akun',
        url: '/dashboard/profil',
        icon: <User className="size-4" />,
      },
    ];

    return {
      name: 'Panel Admin',
      children: adminChildren,
    };
  }

  // 2. Menu Khusus Mentor
  if (isMentorOrAdmin) {
    const mentorChildren: PageTree.Node[] = [
      {
        type: 'separator',
        name: 'Portal Mentor',
      },
      {
        type: 'page',
        name: 'Beranda Mentor',
        url: '/dashboard/mentor',
        icon: <LayoutDashboard className="size-4" />,
      },
      {
        type: 'page',
        name: 'Buka & Rekap Presensi',
        url: '/dashboard/mentor/presensi',
        icon: <CalendarCheck className="size-4" />,
      },
      {
        type: 'page',
        name: 'Kelola Tugas & Proyek',
        url: '/dashboard/dosen/tugas',
        icon: <ClipboardList className="size-4" />,
      },
      {
        type: 'page',
        name: 'Rekap Nilai Siswa',
        url: '/dashboard/dosen/nilai',
        icon: <FileSpreadsheet className="size-4" />,
      },
      {
        type: 'page',
        name: 'Verifikasi Pendaftaran Batch',
        url: '/dashboard/dosen/verifikasi-batch',
        icon: <ClipboardCheck className="size-4" />,
      },

      {
        type: 'separator',
        name: 'Daftar Kelas & Kurikulum',
      },
      ...createCourseNodes(true),

      {
        type: 'separator',
        name: 'Pengaturan',
      },
      {
        type: 'page',
        name: 'Profil Akun',
        url: '/dashboard/profil',
        icon: <User className="size-4" />,
      },
    ];

    return {
      name: 'Portal Mentor',
      children: mentorChildren,
    };
  }

  // Menu Siswa (Student)
  return {
    name: 'SIAKAD',
    children: [
      {
        type: 'separator',
        name: 'Portal Siswa',
      },
      {
        type: 'page',
        name: 'Beranda',
        url: '/dashboard/siswa',
        icon: <LayoutDashboard className="size-4" />,
      },
      {
        type: 'page',
        name: 'Pendaftaran Batch',
        url: '/dashboard/batch',
        icon: <Layers className="size-4" />,
      },
      {
        type: 'page',
        name: 'Presensi Sesi',
        url: '/dashboard/siswa/presensi',
        icon: <CalendarCheck className="size-4" />,
      },
      {
        type: 'page',
        name: 'Tugas & Proyek',
        url: '/dashboard/assignments',
        icon: <CheckSquare className="size-4" />,
      },
      {
        type: 'page',
        name: 'Laporan Hasil Belajar',
        url: '/dashboard/khs',
        icon: <GraduationCap className="size-4" />,
      },

      // Divider: "Daftar Kelas" untuk Siswa (Hanya jika memiliki kelas aktif)
      ...(classroomCourses && classroomCourses.length > 0
        ? [
            {
              type: 'separator' as const,
              name: 'Daftar Kelas',
            },
            ...createCourseNodes(false),
          ]
        : []),

      {
        type: 'separator',
        name: 'Pengaturan',
      },
      {
        type: 'page',
        name: 'Profil Akun',
        url: '/dashboard/profil',
        icon: <User className="size-4" />,
      },
    ],
  };
}

export const dashboardPageTree: PageTree.Root = getDashboardTree();
