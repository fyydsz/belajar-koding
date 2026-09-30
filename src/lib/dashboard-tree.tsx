import type * as PageTree from 'fumadocs-core/page-tree';
import {
  LayoutDashboard,
  CalendarCheck,
  BookOpenCheck,
  GraduationCap,
  CheckSquare,
  User,
} from 'lucide-react';

export const dashboardPageTree: PageTree.Root = {
  name: 'SIAKAD',
  children: [
    {
      type: 'separator',
      name: 'Akademik & SIAKAD',
    },
    {
      type: 'page',
      name: 'Beranda',
      url: '/dashboard',
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      type: 'page',
      name: 'Presensi',
      url: '/dashboard/presensi',
      icon: <CalendarCheck className="size-4" />,
    },
    {
      type: 'page',
      name: 'KRS',
      url: '/dashboard/krs',
      icon: <BookOpenCheck className="size-4" />,
    },
    {
      type: 'page',
      name: 'KHS',
      url: '/dashboard/khs',
      icon: <GraduationCap className="size-4" />,
    },
    {
      type: 'page',
      name: 'Tugas & Discord',
      url: '/dashboard/assignments',
      icon: <CheckSquare className="size-4" />,
    },
    {
      type: 'page',
      name: 'Profil',
      url: '/dashboard/profil',
      icon: <User className="size-4" />,
    },
  ],
};
