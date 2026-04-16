/**
 * Designer Shell — 3-panelowy layout dla Echelon Page Inspector.
 *
 * Milestone tracker (VISUAL_DESIGNER_ROADMAP.md, Phase 1):
 *   M1 [current]  szkielet + 3 panele                          ← ty tu jesteś
 *   M2            Page picker + breadcrumb
 *   M3            Canvas read-only preview
 *   M4            Palette — WIDGET_REGISTRY lista
 *   M5            Inspector — manifest + config per widget
 *   M6            Source view — generated PageBuilder TS
 *
 * Cel v1.0: edytor z którym BA tworzy strony bez dotykania kodu.
 * Ten widget to trzon Fazy 1 (read-only).
 */
import { computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { EchelonWidget } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { PageConfig } from '@echelon-framework/core';

interface PageEntry {
  readonly id: string;
  readonly title: string;
  readonly route: string;
  readonly config: PageConfig;
  readonly widgetCount: number;
  readonly dsCount: number;
  readonly computedCount: number;
  readonly handlerCount: number;
  readonly sourceClassName: string;
}

@EchelonWidget({
  manifest: {
    type: 'designer-shell',
    version: '0.1.0',
    category: 'designer',
    description: 'Page Inspector shell — 3-column layout (palette / canvas / inspector).',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: ['designer-shell'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-designer-shell',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="shell" data-testid="designer-shell" data-echelon-state="ready">
      <aside class="palette">
        <h3>Palette</h3>
        <div class="placeholder">⏳ M4 — tutaj lista zarejestrowanych widgetów</div>
      </aside>

      <main class="canvas">
        <header class="canvas-bar">
          <label class="picker">
            <span>Strona:</span>
            <select [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)">
              @for (p of pages; track p.id) {
                <option [value]="p.id">{{ p.title }} — {{ p.route }}</option>
              }
            </select>
          </label>
          @if (selectedPage(); as p) {
            <div class="breadcrumb">
              <span class="crumb class">{{ p.sourceClassName }}</span>
              <span class="sep">›</span>
              <span class="crumb id">{{ p.id }}</span>
              <span class="sep">›</span>
              <span class="crumb route">{{ p.route }}</span>
            </div>
            <div class="meta">
              <span title="Widgety"><span class="ic">🧩</span>{{ p.widgetCount }}</span>
              <span title="Datasources"><span class="ic">📦</span>{{ p.dsCount }}</span>
              <span title="Computed"><span class="ic">ƒ</span>{{ p.computedCount }}</span>
              <span title="Handlery"><span class="ic">⚡</span>{{ p.handlerCount }}</span>
            </div>
          }
        </header>
        <section class="canvas-area">
          @if (selectedPage(); as p) {
            <div class="preview-toolbar">
              <span class="preview-mode">🔍 Read-only preview</span>
              <div class="preview-actions">
                <button type="button" (click)="reloadPreview()" title="Przeładuj preview">↻</button>
                <a [href]="p.route" target="_blank" rel="noopener" title="Otwórz w nowej karcie">↗ Open</a>
              </div>
            </div>
            <div class="preview-frame" [class.loading]="previewLoading()">
              <iframe #previewFrame
                      [src]="previewUrl()"
                      sandbox="allow-same-origin allow-scripts allow-forms"
                      (load)="onPreviewLoad()"
                      title="Page Preview"></iframe>
              @if (previewLoading()) {
                <div class="preview-spinner">⏳ Ładowanie…</div>
              }
            </div>
          } @else {
            <div class="placeholder">Wybierz stronę z dropdown żeby zobaczyć preview</div>
          }
        </section>
      </main>

      <aside class="inspector">
        <h3>Inspector</h3>
        <div class="placeholder">⏳ M5 — klik widget w canvas → manifest, config, plik</div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; min-height: calc(100vh - 120px); }
    .shell {
      display: grid;
      grid-template-columns: 260px 1fr 340px;
      gap: 12px;
      height: 100%;
      min-height: inherit;
    }
    .palette, .inspector, .canvas {
      background: var(--panel-alt, #111827);
      border: 1px solid var(--border, #1f2937);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .palette, .inspector { padding: 14px 16px; overflow-y: auto; }
    .canvas { padding: 0; overflow: hidden; }
    .canvas-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border, #1f2937);
      background: var(--panel, #0f172a);
      flex-wrap: wrap;
    }
    .canvas-area { flex: 1; padding: 16px; overflow: auto; min-height: 0; }
    h3 {
      margin: 0 0 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted, #9ca3af);
      font-weight: 600;
    }
    .placeholder, .placeholder-inline {
      color: var(--muted, #6b7280);
      font-size: 12px;
      font-style: italic;
    }
    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      border: 1px dashed var(--border, #374151);
      border-radius: 4px;
      text-align: center;
      min-height: 60px;
      line-height: 1.4;
    }
    .canvas-area .placeholder { min-height: 200px; }

    .picker { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .picker span { color: var(--muted, #9ca3af); }
    .picker select { padding: 6px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 13px; min-width: 240px; cursor: pointer; }

    .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted, #9ca3af); flex-wrap: wrap; }
    .crumb { padding: 2px 8px; background: #1f2937; border-radius: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .crumb.class { color: #a78bfa; }
    .crumb.id { color: #60a5fa; }
    .crumb.route { color: #10b981; }
    .sep { color: var(--muted, #6b7280); }

    .meta { margin-left: auto; display: flex; gap: 10px; font-size: 12px; color: var(--muted, #9ca3af); }
    .meta span { display: flex; align-items: center; gap: 4px; }
    .meta .ic { font-size: 13px; }

    .preview-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #1f2937; border: 1px solid var(--border, #374151); border-bottom: none; border-radius: 4px 4px 0 0; font-size: 12px; }
    .preview-mode { color: var(--muted, #9ca3af); }
    .preview-actions { display: flex; gap: 6px; }
    .preview-actions button, .preview-actions a { padding: 3px 8px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; text-decoration: none; }
    .preview-actions button:hover, .preview-actions a:hover { border-color: #58a6ff; }

    .preview-frame { position: relative; width: 100%; flex: 1; min-height: 500px; border: 1px solid var(--border, #374151); border-radius: 0 0 4px 4px; overflow: hidden; background: #fff; }
    .preview-frame iframe { width: 100%; height: 100%; min-height: 500px; border: none; display: block; background: var(--panel, #0f172a); }
    .preview-frame.loading iframe { opacity: 0.3; }
    .preview-spinner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--muted, #9ca3af); background: rgba(15, 23, 42, 0.6); }
  `],
})
export class DesignerShellComponent {
  readonly pages: ReadonlyArray<PageEntry> = this.collectPages();
  readonly selectedId = signal<string>(this.pages[0]?.id ?? '');
  readonly selectedPage = computed<PageEntry | null>(() =>
    this.pages.find((p) => p.id === this.selectedId()) ?? null,
  );
  readonly previewLoading = signal<boolean>(false);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly reloadTrigger = signal<number>(0);
  readonly previewUrl = computed<SafeUrl | null>(() => {
    const p = this.selectedPage();
    if (!p) return null;
    const bust = this.reloadTrigger();
    const url = bust > 0 ? `${p.route}?_reload=${bust}` : p.route;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    effect(() => {
      // Gdy zmienia się selected page — ustaw loading dopóki iframe nie wywoła onPreviewLoad
      this.selectedId();
      this.previewLoading.set(true);
    });
  }

  onPreviewLoad(): void {
    this.previewLoading.set(false);
  }

  reloadPreview(): void {
    this.previewLoading.set(true);
    this.reloadTrigger.update((v) => v + 1);
  }

  private collectPages(): ReadonlyArray<PageEntry> {
    const classes = getRegisteredPageClasses() as Array<{ name?: string; config?: PageConfig }>;
    const out: PageEntry[] = [];
    for (const cls of classes) {
      const cfg = cls?.config;
      if (!cfg?.page?.id) continue;
      const page = cfg.page;
      const widgetCount = Object.keys(page.widgets ?? {}).length;
      const dsCount = Object.keys(page.datasources ?? {}).length;
      const computedCount = Object.keys(page.computed ?? {}).length;
      const handlerCount = (page.eventHandlers ?? []).length;
      out.push({
        id: page.id,
        title: page.title ?? page.id,
        route: this.routeFromClass(cls) ?? `/${page.id}`,
        config: cfg,
        widgetCount, dsCount, computedCount, handlerCount,
        sourceClassName: cls.name ?? 'UnknownPage',
      });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }

  private routeFromClass(cls: unknown): string | undefined {
    // @Page decorator zapisuje meta w __echelonPage__ (jeśli dostępne). Pomijamy bez typesafe.
    const meta = (cls as { __echelonPage__?: { route?: string } }).__echelonPage__;
    return meta?.route;
  }
}
