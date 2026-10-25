'use client';

import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FileDropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  previewUrl?: string | null;
  onClear?: () => void;
  disabled?: boolean;
  maxSizeBytes?: number;
  acceptedFormats?: string[];
  helperText?: string;
  className?: string;
}

export function FileDropzone({
  onFileSelect,
  selectedFile,
  previewUrl,
  onClear,
  disabled = false,
  maxSizeBytes = 5 * 1024 * 1024, // 5MB
  acceptedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'],
  helperText = 'Format file: PNG, JPG, atau PDF (Maksimal 5MB)',
  className,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndHandleFile = useCallback(
    (file: File) => {
      setErrorMessage(null);

      // Check size
      if (file.size > maxSizeBytes) {
        const sizeMb = Math.round(maxSizeBytes / (1024 * 1024));
        setErrorMessage(`Ukuran file melebihi batas maksimal ${sizeMb}MB.`);
        return;
      }

      // Check format
      const isAccepted =
        acceptedFormats.includes(file.type) ||
        (file.name.endsWith('.pdf') && acceptedFormats.includes('application/pdf'));

      if (!isAccepted) {
        setErrorMessage('Format berkas tidak didukung. Harap pilih gambar atau dokumen PDF.');
        return;
      }

      // Generate local preview if image
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setLocalPreview(url);
      } else {
        setLocalPreview(null);
      }

      onFileSelect(file);
    },
    [acceptedFormats, maxSizeBytes, onFileSelect]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndHandleFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndHandleFile(file);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalPreview(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) {
      onClear();
    } else {
      onFileSelect(null);
    }
  };

  const activePreviewUrl = localPreview || previewUrl;
  const isPdf =
    selectedFile?.type === 'application/pdf' ||
    selectedFile?.name.toLowerCase().endsWith('.pdf') ||
    previewUrl?.toLowerCase().includes('.pdf');

  return (
    <div className={cn('w-full space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {selectedFile || activePreviewUrl ? (
        <div className="relative rounded-2xl border border-fd-border bg-fd-card p-4 transition-all shadow-xs">
          <div className="flex items-center gap-3">
            {isPdf ? (
              <div className="size-12 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <FileText className="size-6" />
              </div>
            ) : activePreviewUrl ? (
              <div className="relative size-14 rounded-xl overflow-hidden border border-fd-border shrink-0 bg-fd-muted flex items-center justify-center">
                <img
                  src={activePreviewUrl}
                  alt="Bukti Transfer"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="size-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <ImageIcon className="size-6" />
              </div>
            )}

            <div className="flex-1 min-w-0 pr-8">
              <p className="text-xs font-semibold text-fd-foreground truncate">
                {selectedFile?.name || 'Berkas Bukti Transfer'}
              </p>
              <p className="text-[11px] text-fd-muted-foreground mt-0.5">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Siap diunggah`
                  : 'Berkas telah tersimpan'}
              </p>
            </div>

            {!disabled && (
              <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground transition"
                title="Hapus berkas"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all',
            isDragOver
              ? 'border-fd-primary bg-fd-primary/5'
              : 'border-fd-border hover:border-fd-primary/60 hover:bg-fd-muted/30',
            disabled && 'opacity-50 cursor-not-allowed hover:border-fd-border hover:bg-transparent'
          )}
        >
          <div className="size-11 rounded-full bg-fd-muted group-hover:bg-fd-primary/10 flex items-center justify-center text-fd-muted-foreground group-hover:text-fd-primary transition-colors mb-2.5">
            <UploadCloud className="size-5" />
          </div>

          <p className="text-xs font-semibold text-fd-foreground">
            <span className="text-fd-primary underline underline-offset-2">Klik untuk memilih file</span>{' '}
            atau seret & jatuhkan berkas di sini
          </p>
          <p className="text-[11px] text-fd-muted-foreground mt-1">{helperText}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 pt-0.5">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
