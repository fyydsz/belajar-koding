import React from 'react';
import { source } from '@/lib/source';
import type { Folder, Item, Node } from 'fumadocs-core/page-tree';

export interface CourseModule {
  step: string;
  title: React.ReactNode;
  href: string;
  description?: React.ReactNode;
}

export interface CourseTrack {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  href: string;
  icon?: React.ReactNode;
  modules: CourseModule[];
}

/**
 * Otomatis mendeteksi track materi dan daftar bab di dalamnya dari page tree Fumadocs.
 * Mengikuti urutan dan struktur yang didefinisikan pada meta.json tanpa perlu hardcode.
 */
export function getCourseTracks(): CourseTrack[] {
  const tree = source.getPageTree();
  const children = tree.children;

  // 1. Cari separator penanda materi, seperti "Materi Kelas"
  let afterMateriSeparator = false;
  const courseFolders: Folder[] = [];

  for (const node of children) {
    if (node.type === 'separator') {
      const sepName = String(node.name ?? '').toLowerCase();
      if (sepName.includes('materi') || sepName.includes('kelas') || sepName.includes('kurikulum')) {
        afterMateriSeparator = true;
        continue;
      } else if (afterMateriSeparator) {
        // Hentikan jika mencapai separator kategori lain (misal Informasi)
        break;
      }
    }

    if (afterMateriSeparator && node.type === 'folder') {
      courseFolders.push(node);
    }
  }

  // 2. Fallback: jika tidak ada separator khusus materi, ambil semua folder tingkat atas yang memiliki konten
  const targetFolders =
    courseFolders.length > 0
      ? courseFolders
      : children.filter(
          (node): node is Folder => node.type === 'folder' && ((node.children && node.children.length > 0) || !!node.index)
        );

  return targetFolders.map((folder) => {
    const pages: Item[] = [];

    for (const child of folder.children) {
      if (child.type === 'page') {
        pages.push(child);
      } else if (child.type === 'folder') {
        if (child.index) {
          pages.push(child.index);
        }
        for (const subChild of child.children) {
          if (subChild.type === 'page') {
            pages.push(subChild);
          }
        }
      }
    }

    const indexPage = folder.index;
    const title = indexPage?.name ?? folder.name;
    const description =
      indexPage?.description ?? folder.description ?? 'Modul pembelajaran terstruktur dan praktis.';
    const href = indexPage?.url ?? (pages[0]?.url || '#');
    const icon = indexPage?.icon ?? folder.icon;
    const id =
      (typeof href === 'string' ? href.split('/').filter(Boolean).pop() : undefined) ??
      String(folder.name).toLowerCase().replace(/\s+/g, '-');

    const modules: CourseModule[] = pages.map((page, index) => ({
      step: String(index + 1).padStart(2, '0'),
      title: page.name,
      href: page.url,
      description: page.description,
    }));

    return {
      id,
      title,
      description,
      href,
      icon,
      modules,
    };
  });
}
