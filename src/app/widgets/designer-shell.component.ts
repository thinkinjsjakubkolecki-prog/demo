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
import { WIDGET_REGISTRY } from '@echelon-framework/core';
import type { PageConfig, WidgetManifest, WidgetRegistry } from '@echelon-framework/core';
import { PageDesignerModel, serialize } from '@echelon-framework/designer-page';

interface PaletteGroup {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<WidgetManifest>;
}

interface InspectedWidget {
  readonly instanceId: string;
  readonly type: string;
  readonly pageRoute: string;
  readonly bind: Readonly<Record<string, string>> | undefined;
  readonly options: Readonly<Record<string, unknown>> | undefined;
  readonly when: unknown;
  readonly layout: { readonly x?: number; readonly y?: number; readonly w?: number; readonly h?: number };
  readonly manifest: WidgetManifest | undefined;
}

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
        <h3>Palette <span class="palette-count">{{ totalWidgets() }}</span></h3>
        <input type="search" class="palette-filter" placeholder="Filter widgets…"
               [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
        @if (paletteGroups().length === 0) {
          <div class="placeholder">Brak widgetów pasujących do filtru</div>
        }
        @for (g of paletteGroups(); track g.id) {
          <div class="palette-group">
            <div class="palette-group-header">{{ g.label }} <span class="palette-group-count">{{ g.items.length }}</span></div>
            @for (item of g.items; track item.type) {
              <button type="button" class="palette-item"
                      [title]="item.description || item.type"
                      (click)="selectedWidgetType.set(item.type)"
                      [class.active]="selectedWidgetType() === item.type">
                <span class="p-icon">{{ item.icon || '🔲' }}</span>
                <span class="p-name">{{ item.type }}</span>
                <span class="p-version">v{{ item.version }}</span>
              </button>
            }
          </div>
        }
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
              <div class="tabs">
                <button type="button" class="tab" [class.active]="viewMode() === 'preview'" (click)="viewMode.set('preview')">
                  🔍 Preview
                </button>
                <button type="button" class="tab" [class.active]="viewMode() === 'source-ts'" (click)="viewMode.set('source-ts')">
                  📄 PageBuilder TS
                </button>
                <button type="button" class="tab" [class.active]="viewMode() === 'source-json'" (click)="viewMode.set('source-json')">
                  ⚙ JSON config
                </button>
              </div>
              <div class="preview-actions">
                @if (viewMode() === 'preview') {
                  <button type="button" (click)="reloadPreview()" title="Przeładuj preview">↻</button>
                  <a [href]="p.route" target="_blank" rel="noopener" title="Otwórz w nowej karcie">↗ Open</a>
                }
                @if (viewMode() !== 'preview') {
                  <button type="button" (click)="copySource()" title="Kopiuj do schowka">📋 Copy</button>
                  <span class="src-size muted">{{ sourceLineCount() }} linii</span>
                }
              </div>
            </div>

            @if (viewMode() === 'preview') {
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
              <div class="source-view">
                <pre><code [innerHTML]="highlightedSource()"></code></pre>
              </div>
            }
          } @else {
            <div class="placeholder">Wybierz stronę z dropdown żeby zobaczyć preview</div>
          }
        </section>
      </main>

      <aside class="inspector">
        <h3>Inspector</h3>
        @if (inspectedWidget(); as iw) {
          <div class="inspector-block">
            <div class="inspector-title">{{ iw.instanceId }}</div>
            <div class="inspector-subtitle">{{ iw.type }} <span class="muted">v{{ iw.manifest?.version ?? '?' }}</span></div>
            @if (iw.manifest?.description) {
              <div class="inspector-desc">{{ iw.manifest?.description }}</div>
            }
          </div>

          @if (iw.manifest; as m) {
            <div class="inspector-block">
              <div class="inspector-section">Manifest</div>
              <dl>
                <dt>category</dt><dd>{{ m.category || '—' }}</dd>
                <dt>inputs</dt><dd>{{ m.inputs.length }} <span class="muted">({{ m.inputs.length ? namesOf(m.inputs) : 'brak' }})</span></dd>
                <dt>outputs</dt><dd>{{ m.outputs.length }}</dd>
                <dt>actions</dt><dd>{{ m.actions.length }}</dd>
                <dt>data-bus</dt><dd>{{ m.capabilities.dataBus || '—' }}</dd>
              </dl>
            </div>
          }

          <div class="inspector-block">
            <div class="inspector-section">Bind / Options</div>
            @if (iw.bind && (keys(iw.bind)).length > 0) {
              <dl>
                @for (k of keys(iw.bind); track k) {
                  <dt>bind.{{ k }}</dt><dd><code>{{ formatVal(iw.bind![k]) }}</code></dd>
                }
              </dl>
            }
            @if (iw.options && (keys(iw.options)).length > 0) {
              <dl>
                @for (k of keys(iw.options); track k) {
                  <dt>opt.{{ k }}</dt><dd><code>{{ formatVal(iw.options![k]) }}</code></dd>
                }
              </dl>
            }
            @if (!iw.bind && !iw.options) {
              <div class="muted small">Brak bindings i options</div>
            }
          </div>

          @if (iw.when) {
            <div class="inspector-block">
              <div class="inspector-section">Conditional (when)</div>
              <code class="when">{{ formatVal(iw.when) }}</code>
            </div>
          }

          <div class="inspector-block">
            <div class="inspector-section">Layout</div>
            <dl>
              <dt>x/y</dt><dd>{{ iw.layout.x ?? 0 }} / {{ iw.layout.y ?? 0 }}</dd>
              <dt>w/h</dt><dd>{{ iw.layout.w ?? '—' }} / {{ iw.layout.h ?? 'auto' }}</dd>
            </dl>
          </div>

          <div class="inspector-block">
            <div class="inspector-section">Źródło</div>
            <div class="source-link">
              <span class="muted small">Strona:</span>
              <code>{{ iw.pageRoute }}</code>
            </div>
          </div>
        } @else if (selectedPage(); as sp) {
          <div class="inspector-block">
            <div class="inspector-section">Strona wybrana</div>
            <div class="muted small">Wybierz widget z listy poniżej żeby zobaczyć szczegóły:</div>
            <div class="widget-list">
              @for (w of pageWidgets(); track w.instanceId) {
                <button type="button" class="widget-list-item"
                        [class.active]="inspectedInstanceId() === w.instanceId"
                        (click)="inspectedInstanceId.set(w.instanceId)">
                  <span class="wli-id">{{ w.instanceId }}</span>
                  <span class="wli-type">{{ w.type }}</span>
                </button>
              }
              @if (pageWidgets().length === 0) {
                <div class="muted small">Strona nie ma widgetów</div>
              }
            </div>
          </div>
        } @else {
          <div class="placeholder">Wybierz stronę</div>
        }
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

    .palette-count, .palette-group-count { background: #1f2937; color: var(--muted, #9ca3af); font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 4px; font-weight: normal; }
    .palette-filter { width: 100%; padding: 6px 10px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 12px; margin-bottom: 10px; box-sizing: border-box; }
    .palette-filter:focus { outline: none; border-color: #58a6ff; }
    .palette-group { margin-bottom: 10px; }
    .palette-group-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280); margin-bottom: 4px; font-weight: 600; }
    .palette-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px; background: transparent; border: 1px solid transparent; color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; text-align: left; margin-bottom: 2px; font-family: inherit; }
    .palette-item:hover { background: #1a2332; border-color: var(--border, #374151); }
    .palette-item.active { background: #1e3a5f33; border-color: #58a6ff; }
    .p-icon { width: 16px; text-align: center; font-size: 13px; }
    .p-name { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #93c5fd; }
    .p-version { font-size: 9px; color: var(--muted, #6b7280); }

    .inspector-block { padding: 10px 12px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 4px; margin-bottom: 8px; }
    .inspector-title { font-size: 13px; font-weight: 600; color: #60a5fa; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .inspector-subtitle { font-size: 11px; color: #93c5fd; margin-top: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .inspector-desc { font-size: 11px; color: var(--muted, #9ca3af); margin-top: 6px; line-height: 1.4; font-style: italic; }
    .inspector-section { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280); margin-bottom: 6px; font-weight: 600; }
    .inspector-block dl { display: grid; grid-template-columns: 90px 1fr; gap: 3px 8px; margin: 0; font-size: 11px; }
    .inspector-block dt { color: var(--muted, #9ca3af); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .inspector-block dd { margin: 0; color: var(--fg, #e5e7eb); word-break: break-word; }
    .inspector-block code, .when { background: #1f2937; padding: 1px 4px; border-radius: 2px; font-size: 10px; color: #fcd34d; }
    .when { display: block; padding: 6px; word-break: break-all; }
    .muted { color: var(--muted, #9ca3af); }
    .small { font-size: 11px; }
    .widget-list { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
    .widget-list-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; background: transparent; border: 1px solid transparent; color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 11px; cursor: pointer; text-align: left; font-family: inherit; }
    .widget-list-item:hover { background: #1a2332; border-color: var(--border, #374151); }
    .widget-list-item.active { background: #1e3a5f33; border-color: #58a6ff; }
    .wli-id { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #60a5fa; }
    .wli-type { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #93c5fd; font-size: 10px; }
    .source-link { display: flex; gap: 6px; align-items: center; font-size: 11px; }

    .tabs { display: flex; gap: 4px; }
    .tab { padding: 4px 10px; background: transparent; border: 1px solid transparent; color: var(--muted, #9ca3af); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .tab:hover { color: var(--fg, #e5e7eb); background: #1f2937; }
    .tab.active { background: var(--panel, #0f172a); border-color: #58a6ff; color: #58a6ff; }
    .src-size { font-size: 11px; margin-left: 8px; }

    .source-view { width: 100%; flex: 1; min-height: 500px; border: 1px solid var(--border, #374151); border-radius: 0 0 4px 4px; overflow: auto; background: #0b1120; }
    .source-view pre { margin: 0; padding: 16px; font-size: 12px; line-height: 1.6; color: #d1d5db; font-family: ui-monospace, SFMono-Regular, Menlo, 'Cascadia Code', monospace; tab-size: 2; }
    .source-view code { background: transparent; padding: 0; font-size: inherit; color: inherit; }
    .tk-kw { color: #c792ea; }
    .tk-str { color: #c3e88d; }
    .tk-num { color: #f78c6c; }
    .tk-com { color: #676e95; font-style: italic; }
    .tk-dec { color: #ffcb6b; }
    .tk-key { color: #82aaff; }
  `],
})
export class DesignerShellComponent {
  readonly pages: ReadonlyArray<PageEntry> = this.collectPages();
  readonly selectedId = signal<string>(this.pages[0]?.id ?? '');
  readonly selectedPage = computed<PageEntry | null>(() =>
    this.pages.find((p) => p.id === this.selectedId()) ?? null,
  );
  readonly previewLoading = signal<boolean>(false);
  readonly selectedWidgetType = signal<string | null>(null);
  readonly filter = signal<string>('');
  readonly inspectedInstanceId = signal<string | null>(null);
  readonly viewMode = signal<'preview' | 'source-ts' | 'source-json'>('preview');

  readonly generatedSource = computed<string>(() => {
    const p = this.selectedPage();
    if (!p) return '';
    const mode = this.viewMode();
    if (mode === 'preview') return '';
    const draft = PageDesignerModel.fromPageConfig(p.config).snapshot();
    return serialize(draft, { target: mode === 'source-ts' ? 'page-builder' : 'json' });
  });

  readonly sourceLineCount = computed<number>(() => {
    const src = this.generatedSource();
    return src ? src.split('\n').length : 0;
  });

  readonly highlightedSource = computed<string>(() => {
    return highlightSource(this.generatedSource(), this.viewMode());
  });

  readonly pageWidgets = computed<ReadonlyArray<{ instanceId: string; type: string }>>(() => {
    const p = this.selectedPage();
    if (!p) return [];
    const widgets = p.config.page.widgets ?? {};
    return Object.entries(widgets).map(([instanceId, w]) => ({ instanceId, type: w.type }));
  });

  readonly inspectedWidget = computed<InspectedWidget | null>(() => {
    const p = this.selectedPage();
    const id = this.inspectedInstanceId();
    if (!p || !id) return null;
    const widgetCfg = (p.config.page.widgets ?? {})[id];
    if (!widgetCfg) return null;
    const layoutItem = p.config.page.layout.items.find((it) => it.widget === id) as { x?: number; y?: number; w?: number; h?: number } | undefined ?? {};
    const manifest = this.registry?.get(widgetCfg.type)?.manifest;
    return {
      instanceId: id,
      type: widgetCfg.type,
      pageRoute: p.route,
      bind: widgetCfg.bind,
      options: widgetCfg.options,
      when: widgetCfg.when,
      layout: { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h },
      manifest,
    };
  });
  private readonly registry = inject(WIDGET_REGISTRY as never, { optional: true }) as WidgetRegistry | null;
  private readonly allManifests = computed<ReadonlyArray<WidgetManifest>>(() => {
    return this.registry ? [...this.registry.all()] : [];
  });
  readonly totalWidgets = computed<number>(() => this.allManifests().length);
  readonly paletteGroups = computed<ReadonlyArray<PaletteGroup>>(() => {
    const q = this.filter().trim().toLowerCase();
    const filtered = q
      ? this.allManifests().filter((m) =>
          m.type.toLowerCase().includes(q) ||
          (m.description ?? '').toLowerCase().includes(q) ||
          (m.category ?? '').toLowerCase().includes(q),
        )
      : this.allManifests();
    const byCategory = new Map<string, WidgetManifest[]>();
    for (const m of filtered) {
      const cat = m.category ?? 'general';
      const bucket = byCategory.get(cat) ?? [];
      bucket.push(m);
      byCategory.set(cat, bucket);
    }
    const groups: PaletteGroup[] = [];
    for (const [id, items] of byCategory) {
      items.sort((a, b) => a.type.localeCompare(b.type));
      groups.push({ id, label: humanize(id), items });
    }
    groups.sort((a, b) => a.label.localeCompare(b.label));
    return groups;
  });
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

  namesOf(arr: ReadonlyArray<{ name: string }>): string {
    return arr.map((x) => x.name).join(', ');
  }

  keys(obj: Readonly<Record<string, unknown>> | undefined): ReadonlyArray<string> {
    return obj ? Object.keys(obj) : [];
  }

  formatVal(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
  }

  copySource(): void {
    const src = this.generatedSource();
    if (typeof navigator !== 'undefined' && navigator.clipboard && src) {
      void navigator.clipboard.writeText(src);
    }
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

function humanize(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const TS_KEYWORDS = /\b(import|from|export|class|static|readonly|const|return|true|false|null|undefined|type|interface|this)\b/g;
const TS_DECORATORS = /(@\w+)/g;
const TS_STRINGS = /(&#39;[^&]*?&#39;|&quot;[^&]*?&quot;|&#96;[^&]*?&#96;)/g;
const TS_COMMENTS = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
const TS_NUMBERS = /\b(\d+\.?\d*)\b/g;
const JSON_STRINGS = /(&quot;[^&]*?&quot;)(?=\s*:)/g;
const JSON_STRINGS_VALUE = /:(\s*)(&quot;[^&]*?&quot;)/g;
const JSON_KEYWORDS = /\b(true|false|null)\b/g;

function highlightSource(src: string, mode: 'preview' | 'source-ts' | 'source-json'): string {
  if (!src) return '';
  const esc = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
  if (mode === 'source-ts') {
    return esc
      .replace(TS_COMMENTS, '<span class="tk-com">$1</span>')
      .replace(TS_STRINGS, '<span class="tk-str">$1</span>')
      .replace(TS_DECORATORS, '<span class="tk-dec">$1</span>')
      .replace(TS_KEYWORDS, '<span class="tk-kw">$1</span>')
      .replace(TS_NUMBERS, '<span class="tk-num">$1</span>');
  }
  // JSON
  return esc
    .replace(JSON_STRINGS, '<span class="tk-key">$1</span>')
    .replace(JSON_STRINGS_VALUE, ':$1<span class="tk-str">$2</span>')
    .replace(JSON_KEYWORDS, '<span class="tk-kw">$1</span>')
    .replace(JSON_NUMBERS_SAFE, (m) => `<span class="tk-num">${m}</span>`);
}

// JSON number matcher applied after strings/keywords — safe regex
const JSON_NUMBERS_SAFE = /(?<=[:\s,[])-?\d+\.?\d*(?=[\s,}\]])/g;
