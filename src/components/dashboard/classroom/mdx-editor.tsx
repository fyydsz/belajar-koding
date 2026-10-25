'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
  FileCode,
  Quote,
  Sparkles,
  Link2,
  Table as TableIcon,
  Eye,
  Edit3,
  Columns,
  HelpCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { DynamicMDXRenderer } from '@/components/mdx/dynamic-mdx-renderer';
import { cn } from '@/lib/cn';

interface MDXEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function MDXEditor({
  value,
  onChange,
  placeholder = 'Tulis materi atau petunjuk menggunakan format MDX/Markdown di sini...',
  minHeight = '360px',
}: MDXEditorProps) {
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Exit fullscreen on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Helper to insert markdown text around or at selection
  const insertText = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const selectedText = currentVal.substring(start, end) || defaultPlaceholder;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    onChange(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 0);
  };

  const applyTemplate = (type: 'silabus' | 'materi' | 'praktikum') => {
    let tpl = '';
    if (type === 'silabus') {
      tpl = `# Kontrak Perkuliahan & Silabus Sesi\n\nSelamat datang di sesi ini! Berikut adalah rincian materi dan panduan pengerjaan.\n\n## 🎯 Tujuan Pembelajaran\n1. Memahami konsep dasar dan arsitektur topik ini.\n2. Mampu mengimplementasikan solusi kode secara mandiri.\n\n> [!NOTE]\n> Pelajari materi sebelum mengikuti sesi kuis atau pengumpulan tugas mingguan.\n\n## 📚 Referensi Bacaan\n- Dokumentasi resmi framework/bahasa\n- Slide presentasi terlampir di bagian bawah`;
    } else if (type === 'materi') {
      tpl = `# Judul Materi Pertemuan\n\nPenjelasan singkat pengantar topik yang akan dibahas pada modul ini.\n\n## Konsep Utama\nUraikan konsep secara mendalam dengan poin-poin yang mudah dipahami mahasiswa:\n- **Poin 1**: Penjelasan spesifik.\n- **Poin 2**: Praktik terbaik yang dianjurkan.\n\n\`\`\`javascript\n// Contoh implementasi kode\nfunction hitungNilai(ujian, tugas) {\n  return (ujian * 0.7) + (tugas * 0.3);\n}\n\`\`\`\n\n> [!TIP]\n> Gunakan teknik ini untuk mempercepat eksekusi dan meminimalkan memory footprint.`;
    } else if (type === 'praktikum') {
      tpl = `# Panduan Tugas / Praktikum Lab\n\nKerjakan instruksi di bawah ini dengan teliti.\n\n## 📋 Langkah Pengerjaan\n1. Buat folder proyek baru dan inisialisasi repositori Git.\n2. Implementasikan fitur yang diminta pada soal.\n3. Jalankan pengujian mandiri sebelum melakukan *commit*.\n\n> [!IMPORTANT]\n> Batas waktu pengumpulan tidak dapat diperpanjang. Pastikan tautan repository bersifat publik atau dapat diakses mentor.\n\n### Format Pengumpulan\nKirimkan URL repository GitHub atau link arsip file Google Drive.`;
    }

    if (value.trim() && !window.confirm('Teks yang sudah ditulis akan ditimpa dengan template baru. Lanjutkan?')) {
      return;
    }
    onChange(tpl);
  };

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-xs"
          onClick={() => setIsFullscreen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          'w-full rounded-2xl border border-fd-border bg-fd-card overflow-hidden shadow-sm flex flex-col transition-all duration-200',
          isFullscreen
            ? 'fixed inset-2 sm:inset-4 md:inset-6 z-[70] shadow-2xl border-fd-border/80'
            : ''
        )}
      >
        {/* Toolbar Atas */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-fd-muted/30 border-b border-fd-border text-xs">
          {/* Formatting Actions */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => insertText('**', '**', 'teks tebal')}
              title="Tebal (Bold)"
              aria-label="Tebal (Bold)"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Bold className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertText('*', '*', 'teks miring')}
              title="Miring (Italic)"
              aria-label="Miring (Italic)"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Italic className="size-4" />
            </button>
            <span className="w-px h-4 bg-fd-border mx-1" />
            <button
              type="button"
              onClick={() => insertText('# ', '', 'Judul Utama')}
              title="Heading 1"
              aria-label="Heading 1"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Heading1 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertText('## ', '', 'Sub-Judul')}
              title="Heading 2"
              aria-label="Heading 2"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Heading2 className="size-4" />
            </button>
            <span className="w-px h-4 bg-fd-border mx-1" />
            <button
              type="button"
              onClick={() => insertText('- ', '', 'Poin item')}
              title="Bullet List"
              aria-label="Bullet List"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertText('1. ', '', 'Langkah pertama')}
              title="Numbered List"
              aria-label="Numbered List"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <ListOrdered className="size-4" />
            </button>
            <span className="w-px h-4 bg-fd-border mx-1" />
            <button
              type="button"
              onClick={() => insertText('`', '`', 'kode_singkat')}
              title="Inline Code"
              aria-label="Inline Code"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Code className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertText('```javascript\n', '\n```', '// Tulis kode di sini')}
              title="Fenced Code Block"
              aria-label="Fenced Code Block"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <FileCode className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertText('> [!NOTE]\n> ', '', 'Isi catatan perkuliahan')}
              title="Alert Note"
              aria-label="Alert Note"
              className="p-1.5 rounded hover:bg-fd-muted text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Quote className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertText('> [!TIP]\n> ', '', 'Tips atau saran praktis')}
              title="Alert Tip"
              aria-label="Alert Tip"
              className="p-1.5 rounded hover:bg-fd-muted text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Sparkles className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertText('[', '](https://url-tautan.com)', 'Nama Tautan')}
              title="Tautan / Link"
              aria-label="Tautan / Link"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <Link2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                insertText(
                  '| Kolom 1 | Kolom 2 |\n| :--- | :--- |\n| Baris 1 | Data 1 |\n| Baris 2 | Data 2 |\n'
                )
              }
              title="Tabel"
              aria-label="Tabel"
              className="p-1.5 rounded hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <TableIcon className="size-4" />
            </button>
          </div>

          {/* View Mode Switches, Templates & Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Quick Templates Dropdown */}
            <div className="flex items-center gap-1 bg-fd-background rounded-lg border border-fd-border px-1.5 py-0.5">
              <span className="text-[11px] text-fd-muted-foreground">Template:</span>
              <button
                type="button"
                onClick={() => applyTemplate('silabus')}
                className="px-1.5 py-0.5 rounded text-[11px] hover:bg-fd-muted text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                Silabus
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('materi')}
                className="px-1.5 py-0.5 rounded text-[11px] hover:bg-fd-muted text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                Materi
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('praktikum')}
                className="px-1.5 py-0.5 rounded text-[11px] hover:bg-fd-muted text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              >
                Praktikum
              </button>
            </div>

            {/* Toggle View Mode */}
            <div className="flex items-center bg-fd-background rounded-lg border border-fd-border p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                aria-label="Mode Editor"
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring',
                  viewMode === 'edit'
                    ? 'bg-fd-primary text-fd-primary-foreground'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                )}
              >
                <Edit3 className="size-3.5" />
                <span className="hidden sm:inline">Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                aria-label="Mode Split Editor dan Pratinjau"
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hidden md:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring',
                  viewMode === 'split'
                    ? 'bg-fd-primary text-fd-primary-foreground'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                )}
              >
                <Columns className="size-3.5" />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                aria-label="Mode Pratinjau Saja"
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring',
                  viewMode === 'preview'
                    ? 'bg-fd-primary text-fd-primary-foreground'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                )}
              >
                <Eye className="size-3.5" />
                <span className="hidden sm:inline">Pratinjau</span>
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Keluar Layar Penuh (Esc)' : 'Perbesar / Layar Penuh'}
              aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Perbesar / Layar Penuh'}
              className="p-1 rounded-lg border border-fd-border bg-fd-background hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Editor & Preview Area */}
        <div
          className={cn(
            'grid w-full transition-all duration-200',
            viewMode === 'split'
              ? 'grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-fd-border'
              : 'grid-cols-1',
            isFullscreen ? 'flex-1 min-h-0 h-full overflow-hidden' : ''
          )}
          style={isFullscreen ? { minHeight: 'unset' } : { minHeight }}
        >
          {/* Kolom Editor */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className="flex flex-col h-full bg-fd-background/50 overflow-hidden">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label="Editor MDX"
                style={isFullscreen ? undefined : { minHeight }}
                className={cn(
                  'w-full h-full p-4 font-mono text-sm leading-relaxed bg-transparent text-fd-foreground placeholder:text-fd-muted-foreground/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-fd-primary/50',
                  isFullscreen ? 'resize-none overflow-y-auto' : 'min-h-[360px] resize-y'
                )}
              />
            </div>
          )}

          {/* Kolom Pratinjau MDX */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              className={cn(
                'flex flex-col h-full bg-fd-card/40 p-4 overflow-y-auto',
                isFullscreen ? 'max-h-none flex-1' : 'max-h-[650px]'
              )}
              style={isFullscreen ? undefined : { minHeight }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-fd-muted-foreground/80 mb-2 pb-1 border-b border-fd-border/30 flex items-center justify-between">
                <span>Pratinjau Tampilan Mahasiswa</span>
                <span className="font-normal text-[10px] text-emerald-600 dark:text-emerald-400">MDX Live</span>
              </div>
              {value.trim() ? (
                <DynamicMDXRenderer content={value} />
              ) : (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-fd-muted-foreground/60 text-xs">
                  <HelpCircle className="size-8 mb-2 opacity-30" />
                  <p>Ketik materi di sisi editor untuk melihat hasil render MDX seketika.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
