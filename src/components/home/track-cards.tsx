import React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Code2 } from 'lucide-react';
import { getCourseTracks } from '@/lib/courses';

function TrackIcon({ icon }: { icon?: React.ReactNode }) {
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
      className: 'size-5',
    });
  }
  return <Code2 className="size-5" />;
}

export function TrackCards() {
  const tracks = getCourseTracks();

  if (tracks.length === 0) {
    return (
      <div className="max-w-md mx-auto p-8 rounded-2xl border border-fd-border bg-fd-card/60 text-center">
        <p className="text-sm text-fd-muted-foreground">
          Belum ada materi pembelajaran yang dipublikasikan saat ini.
        </p>
      </div>
    );
  }

  const gridColsClass =
    tracks.length === 1
      ? 'grid-cols-1 max-w-2xl'
      : tracks.length === 2
        ? 'grid-cols-1 md:grid-cols-2 max-w-5xl'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl';

  return (
    <div className={`grid ${gridColsClass} gap-6 w-full mx-auto`}>
      {tracks.map((track) => (
        <div
          key={track.id}
          className="rounded-2xl border border-fd-border bg-fd-card/90 p-6 flex flex-col justify-between shadow-xs hover:border-fd-primary/40 transition-all duration-200"
        >
          <div>
            {/* Header: Icon & Title */}
            <div className="flex items-center gap-3 mb-3.5">
              <div className="size-10 rounded-xl bg-fd-primary/10 text-fd-primary flex items-center justify-center border border-fd-primary/20 shrink-0">
                <TrackIcon icon={track.icon} />
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                {track.title}
              </h3>
            </div>

            {/* Description */}
            <p className="text-sm text-fd-muted-foreground leading-relaxed mb-5">
              {track.description}
            </p>

            {/* Module List */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between text-xs font-semibold text-fd-muted-foreground uppercase tracking-wider mb-2">
                <span>Daftar Modul:</span>
                <span className="font-mono text-[11px] font-normal lowercase">
                  {track.modules.length} bab
                </span>
              </div>

              {track.modules.length === 0 ? (
                <div className="p-3 rounded-xl border border-fd-border/50 bg-fd-secondary/20 text-xs text-fd-muted-foreground text-center">
                  Materi sedang disusun.
                </div>
              ) : (
                <>
                  {track.modules.slice(0, 6).map((m) => (
                    <Link
                      key={m.href}
                      href={m.href}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-fd-border/50 bg-fd-secondary/30 hover:bg-fd-accent/70 hover:border-fd-primary/30 transition-all text-sm text-fd-foreground group"
                    >
                      <div className="flex items-center gap-3 truncate me-2">
                        <span className="font-mono text-xs text-fd-muted-foreground shrink-0 w-5">
                          {m.step}
                        </span>
                        <span className="truncate group-hover:text-fd-primary transition-colors">
                          {m.title}
                        </span>
                      </div>
                      <ChevronRight className="size-4 text-fd-muted-foreground shrink-0 group-hover:text-fd-primary group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}

                  {track.modules.length > 6 && (
                    <Link
                      href={track.href}
                      className="flex items-center justify-center p-2 rounded-xl text-xs text-fd-muted-foreground hover:text-fd-primary transition-colors"
                    >
                      <span>+{track.modules.length - 6} modul lainnya</span>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bottom Action Button */}
          <div className="pt-2">
            <Link
              href={track.href}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
            >
              <span>Buka Materi</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
