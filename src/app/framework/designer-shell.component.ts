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
import { computed, effect, signal, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { EchelonWidget, WIDGET_REGISTRY } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { PageConfig, WidgetManifest, WidgetRegistry } from '@echelon-framework/core';
import { PageDesignerModel, serialize } from '@echelon-framework/designer-page';
import { DraftPageStoreService } from './designer-core';

interface PaletteGroup {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<WidgetManifest>;
}

interface DatasourceConfigShape {
  readonly kind?: 'transport' | 'local' | 'computed';
  readonly transport?: string;
  readonly channel?: string;
  readonly endpoint?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly initial?: unknown;
  readonly fn?: string;
  readonly inputs?: ReadonlyArray<string>;
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
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="shell" data-testid="designer-shell" data-echelon-state="ready">
      <aside class="palette">
        <h3>Palette <span class="palette-count">{{ totalWidgets() }}</span></h3>
        <input #filterInput type="search" class="palette-filter" placeholder="Filter widgets… (/)"
               [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
        @if (editMode()) {
          <div class="palette-hint">Klik na widget → dodaje do strony</div>
        } @else {
          <div class="palette-hint muted-hint">Włącz Edit ON żeby dodawać</div>
        }
        @if (paletteGroups().length === 0) {
          <div class="placeholder">Brak widgetów pasujących do filtru</div>
        }
        @for (g of paletteGroups(); track g.id) {
          <div class="palette-group">
            <div class="palette-group-header">{{ g.label }} <span class="palette-group-count">{{ g.items.length }}</span></div>
            @for (item of g.items; track item.type) {
              <button type="button" class="palette-item"
                      [title]="item.description || item.type"
                      (click)="onPaletteClick(item.type)"
                      [class.active]="selectedWidgetType() === item.type"
                      [class.dragging]="draggingPaletteType() === item.type"
                      [disabled]="!editMode()"
                      [attr.draggable]="editMode() ? 'true' : null"
                      (dragstart)="onPaletteDragStart(item.type, $event)"
                      (dragend)="onPaletteDragEnd()">
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
              @for (d of draftPages(); track d.id) {
                <option [value]="d.id">⚡ {{ d.title }} — {{ d.route }} (NEW)</option>
              }
            </select>
          </label>
          <button type="button" class="btn-new" (click)="openNewPageDialog()" title="Nowa strona (pusta)">➕ New page</button>
          @if (isDraftPage()) {
            <button type="button" class="btn-danger small" (click)="deleteDraft()" title="Usuń ten draft z localStorage">🗑 Delete draft</button>
          }
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
            <div class="edit-controls">
              @if (editMode()) {
                <button type="button" class="btn-undo" [disabled]="!canUndo()" (click)="undo()" title="Cofnij (Ctrl+Z)">↶ Undo</button>
                <button type="button" class="btn-redo" [disabled]="!canRedo()" (click)="redo()" title="Przywróć (Ctrl+Shift+Z)">↷ Redo</button>
                <button type="button" class="btn-save" [disabled]="!hasChanges()" (click)="openSaveDialog()" [title]="hasChanges() ? 'Zapisz do .page.ts' : 'Brak zmian'">💾 Save…</button>
              }
              <button type="button" class="btn-edit" [class.on]="editMode()" (click)="toggleEditMode()" [title]="editMode() ? 'Wyłącz tryb edycji' : 'Włącz tryb edycji'">
                {{ editMode() ? '✏ Edit ON' : '🔒 Read-only' }}
              </button>
            </div>
          }
        </header>
        <section class="canvas-area">
          @if (selectedPage(); as p) {
            <div class="preview-toolbar">
              <div class="tabs">
                <button type="button" class="tab" [class.active]="viewMode() === 'layout'" (click)="viewMode.set('layout')">
                  🧱 Layout
                </button>
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

            @if (viewMode() === 'layout') {
              <div class="layout-canvas"
                   [class.drop-active]="draggingPaletteType() !== null"
                   (dragover)="onCanvasDragOver($event)"
                   (drop)="onCanvasDrop($event)">
                @if (scopeStack().length > 0) {
                  <div class="scope-breadcrumb">
                    <button type="button" class="scope-crumb" (click)="exitToTop()">📄 Top</button>
                    @for (step of scopeStack(); track step.containerId; let last = $last) {
                      <span class="scope-sep">›</span>
                      @if (last) {
                        <span class="scope-crumb current">📦 {{ step.title }}</span>
                      } @else {
                        <button type="button" class="scope-crumb">📦 {{ step.title }}</button>
                      }
                    }
                    <button type="button" class="scope-exit" (click)="exitContainer()" title="Wyjdź z container">⬅ Back</button>
                  </div>
                }

                <!-- Column ruler — 12 slotów zgodnie z Echelon 12-col grid -->
                <div class="col-ruler">
                  @for (c of COLS; track c) {
                    <div class="col-tick">{{ c }}</div>
                  }
                </div>

                <!-- Row ruler + grid area: side-by-side -->
                <div class="canvas-body">
                  <div class="row-ruler">
                    @for (r of rowIndices(); track r) {
                      <div class="row-tick">{{ r }}</div>
                    }
                  </div>

                  <div class="layout-grid"
                       [style.grid-template-rows]="gridTemplateRows()">
                    @for (w of layoutCells(); track w.instanceId) {
                      <div class="primitive-card"
                           [style.grid-column-start]="(w.x ?? 0) + 1"
                           [style.grid-column-end]="'span ' + (w.w || 12)"
                           [style.grid-row-start]="(w.y ?? 0) + 1"
                           [style.grid-row-end]="'span ' + (w.h || 1)"
                           [class.active]="inspectedInstanceId() === w.instanceId"
                           [class.required-empty]="w.hasRequiredUnfilled"
                           [class.is-container]="w.type === 'container'"
                           [attr.draggable]="editMode() ? 'true' : null"
                           (click)="inspectedInstanceId.set(w.instanceId)"
                           (dragstart)="onPrimitiveDragStart(w.instanceId, $event)"
                           (dragover)="onPrimitiveDragOver($event)"
                           (drop)="onPrimitiveDrop(w.instanceId, $event)"
                           (dragend)="onPrimitiveDragEnd()">
                        <div class="prim-top">
                          <span class="prim-icon">{{ w.icon || '🔲' }}</span>
                          <span class="prim-type">{{ w.type }}</span>
                          <span class="prim-dim">{{ w.w ?? 12 }}×{{ w.h ?? 1 }}</span>
                        </div>
                        <div class="prim-center">
                          <div class="prim-id">{{ w.instanceId }}</div>
                          @if (w.bindings.length > 0) {
                            <div class="prim-bindings">
                              @for (b of w.bindings; track b.key) {
                                <span class="prim-bind" [title]="b.key + ' = ' + b.value">
                                  <span class="b-key">{{ b.key }}:</span>
                                  <span class="b-val">{{ b.value }}</span>
                                </span>
                              }
                            </div>
                          }
                          @if (w.hasRequiredUnfilled) {
                            <div class="prim-warning">⚠ niepodpięte required</div>
                          }
                        </div>
                        @if (editMode()) {
                          <div class="prim-actions" (click)="$event.stopPropagation()">
                            @if (w.type === 'container') {
                              <button type="button" class="btn-tiny container-enter" (click)="enterContainer(w.instanceId)" title="Wejdź w scope container (M29 — init + breadcrumb)">⬇ Enter</button>
                            }
                            <button type="button" class="btn-tiny" (click)="moveWidget(w.instanceId, 'up')" title="y--">↑</button>
                            <button type="button" class="btn-tiny" (click)="moveWidget(w.instanceId, 'down')" title="y++">↓</button>
                            <button type="button" class="btn-tiny" (click)="splitHorizontal(w.instanceId)" title="Podziel w poziomie (duplikat obok)">⇔</button>
                            <button type="button" class="btn-tiny" (click)="splitVertical(w.instanceId)" title="Podziel w pionie (duplikat pod)">⇕</button>
                            <button type="button" class="btn-tiny danger" (click)="removeWidgetById(w.instanceId)" title="Usuń">✕</button>
                          </div>
                          <div class="prim-fractions" (click)="$event.stopPropagation()">
                            <button type="button" class="frac" [class.active]="w.w === 3" (click)="setWidgetFraction(w.instanceId, '1/4')" title="1/4 szerokości (w=3)">¼</button>
                            <button type="button" class="frac" [class.active]="w.w === 4" (click)="setWidgetFraction(w.instanceId, '1/3')" title="1/3 (w=4)">⅓</button>
                            <button type="button" class="frac" [class.active]="w.w === 6" (click)="setWidgetFraction(w.instanceId, '1/2')" title="1/2 (w=6)">½</button>
                            <button type="button" class="frac" [class.active]="w.w === 8" (click)="setWidgetFraction(w.instanceId, '2/3')" title="2/3 (w=8)">⅔</button>
                            <button type="button" class="frac" [class.active]="w.w === 9" (click)="setWidgetFraction(w.instanceId, '3/4')" title="3/4 (w=9)">¾</button>
                            <button type="button" class="frac" [class.active]="(w.w ?? 12) === 12" (click)="setWidgetFraction(w.instanceId, '1/1')" title="Full (w=12)">1</button>
                          </div>
                        }
                      </div>
                    }
                    @if (layoutCells().length === 0) {
                      <div class="layout-empty">
                        <div class="empty-icon">📐</div>
                        <div class="empty-title">Pusta strona</div>
                        <div class="empty-desc">
                          @if (editMode()) {
                            Klik widget w palette albo przeciągnij go tutaj żeby dodać.
                          } @else {
                            Włącz Edit ON (Ctrl+E) żeby dodawać widgety.
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>

                @if (editMode() && draggingPaletteType()) {
                  <div class="layout-drop-overlay">
                    <div class="drop-hint">
                      <span class="drop-icon">📥</span>
                      <span class="drop-label">Upuść widget</span>
                      <span class="drop-type">{{ draggingPaletteType() }}</span>
                    </div>
                  </div>
                }
              </div>
            } @else if (viewMode() === 'preview') {
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
        <details class="shortcuts-help">
          <summary>⌨ Skróty</summary>
          <dl>
            <dt><kbd>/</kbd></dt><dd>Filter palette</dd>
            <dt><kbd>Esc</kbd></dt><dd>Odznacz widget</dd>
            <dt><kbd>Del</kbd></dt><dd>Usuń zaznaczony</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>Z</kbd></dt><dd>Undo</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></dt><dd>Redo</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>E</kbd></dt><dd>Toggle edit</dd>
            <dt><kbd>Shift</kbd>+<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></dt><dd>Move widget</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></dt><dd>Resize widget</dd>
          </dl>
        </details>
        @if (inspectedWidget(); as iw) {
          <div class="inspector-block">
            <div class="inspector-header-row">
              <div>
                <div class="inspector-title">{{ iw.instanceId }}</div>
                <div class="inspector-subtitle">{{ iw.type }} <span class="muted">v{{ iw.manifest?.version ?? '?' }}</span></div>
              </div>
              @if (editMode()) {
                <button type="button" class="btn-danger" (click)="deleteInspectedWidget()" title="Usuń widget z strony">🗑 Delete</button>
              }
            </div>
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

          @if (editMode()) {
            <div class="inspector-block">
              <div class="inspector-section">Typ widgetu</div>
              <select class="inline-edit full" [value]="iw.type" (change)="onWidgetTypeChange(iw.instanceId, $event)">
                @for (g of paletteGroups(); track g.id) {
                  <optgroup [label]="g.label">
                    @for (item of g.items; track item.type) {
                      <option [value]="item.type">{{ item.type }}</option>
                    }
                  </optgroup>
                }
              </select>
              <div class="muted small" style="margin-top: 4px;">Zmiana typu zachowa bind/options (te które pasują do nowego manifestu).</div>
            </div>
          }

          @if (iw.type === 'validated-form') {
            <div class="inspector-block form-builder-block">
              <div class="inspector-section">
                📋 Form Builder
                <span class="count-pill">{{ formFields().length }} pól</span>
                <a routerLink="/designer/forms" class="btn-mini" title="Edytuj pola + akcje w dedykowanej sekcji">↗ Forms Designer</a>
              </div>
              <div class="fb-fields-ro">
                @for (f of formFields(); track f.id) {
                  <div class="fb-row-ro">
                    <span class="fb-type">{{ f.type }}</span>
                    <span class="fb-id">{{ f.id }}</span>
                    @if (f.required) { <span class="fb-badge">req</span> }
                  </div>
                }
                @if (formFields().length === 0) {
                  <div class="muted small">Brak pól — dodaj w <a routerLink="/designer/forms">Forms Designer</a></div>
                }
              </div>
            </div>
          }

          @if (manifestSlots().length > 0) {
            <div class="inspector-block slot-block">
              <div class="inspector-section">
                ⚡ Manifest — wymagane / dostępne pola
                <span class="count-pill">{{ manifestSlots().length }}</span>
              </div>
              <div class="slots">
                @for (slot of manifestSlots(); track slot.name) {
                  <div class="slot" [class.filled]="slot.filled" [class.required]="slot.required">
                    <div class="slot-head">
                      <span class="slot-name">{{ slot.name }}</span>
                      <span class="slot-type">{{ slot.type }}</span>
                      @if (slot.required) { <span class="slot-req">required</span> }
                      @if (slot.filled) { <span class="slot-status">✓</span> }
                    </div>
                    @if (slot.description) {
                      <div class="slot-desc">{{ slot.description }}</div>
                    }
                    @if (slot.filled) {
                      <div class="slot-value">
                        <code>{{ slot.currentValue }}</code>
                        @if (editMode()) {
                          <button type="button" class="btn-tiny" (click)="unbindSlot(iw.instanceId, slot.name, slot.filledAs)" title="Usuń powiązanie">✕</button>
                        }
                      </div>
                    } @else if (editMode()) {
                      <div class="slot-actions">
                        <select class="inline-edit ds-picker"
                                (change)="bindSlotFromDatasource(iw.instanceId, slot.name, $event)">
                          <option value="">— podepnij datasource —</option>
                          @for (t of bindTargets(); track t.name) {
                            <option [value]="t.name">{{ t.kind }}: {{ t.name }}</option>
                          }
                        </select>
                        <button type="button" class="btn-tiny" (click)="bindSlotAsValue(iw.instanceId, slot.name, slot.type)" title="Ustaw stałą wartość">literał</button>
                      </div>
                    } @else {
                      <div class="slot-empty muted small">Niepodpięte</div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <div class="inspector-block">
            <div class="inspector-section">
              Bind / Options {{ editMode() ? '(edytuj)' : '' }}
              @if (editMode()) {
                <button type="button" class="btn-mini" (click)="addBindKey(iw.instanceId)" title="Dodaj bind field">+ bind</button>
                <button type="button" class="btn-mini" (click)="addOptionKey(iw.instanceId)" title="Dodaj options field">+ opt</button>
              }
            </div>
            @if (iw.bind && (keys(iw.bind)).length > 0) {
              <dl>
                @for (k of keys(iw.bind); track k) {
                  <dt>bind.{{ k }}</dt>
                  <dd>
                    @if (editMode()) {
                      <div class="bind-row">
                        <input type="text" class="inline-edit"
                               [value]="asString(iw.bind![k])"
                               [attr.list]="'bind-targets-' + iw.instanceId"
                               (change)="onBindChange(iw.instanceId, k, $event)" />
                        <button type="button" class="btn-rm" (click)="removeBindKey(iw.instanceId, k)" title="Usuń">✕</button>
                      </div>
                    } @else {
                      <code>{{ formatVal(iw.bind![k]) }}</code>
                    }
                  </dd>
                }
              </dl>
              @if (editMode()) {
                <datalist [id]="'bind-targets-' + iw.instanceId">
                  @for (t of bindTargets(); track t.name) {
                    <option [value]="t.name">{{ t.kind }}</option>
                  }
                </datalist>
              }
            }
            @if (iw.options && (keys(iw.options)).length > 0) {
              <dl>
                @for (k of keys(iw.options); track k) {
                  <dt>opt.{{ k }}</dt>
                  <dd>
                    @if (editMode() && isScalarOption(iw.options![k])) {
                      <div class="bind-row">
                        <input type="text" class="inline-edit"
                               [value]="asString(iw.options![k])"
                               (change)="onOptionChange(iw.instanceId, k, $event)" />
                        <button type="button" class="btn-rm" (click)="removeOptionKey(iw.instanceId, k)" title="Usuń">✕</button>
                      </div>
                    } @else {
                      <code>{{ formatVal(iw.options![k]) }}</code>
                    }
                  </dd>
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
            <div class="inspector-section">Layout {{ editMode() ? '(edytuj)' : '' }}</div>
            @if (editMode()) {
              <div class="layout-grid">
                <label><span>x</span><input type="number" min="0" max="11" class="inline-edit"
                       [value]="iw.layout.x ?? 0"
                       (change)="onLayoutChange(iw.instanceId, 'x', $event)"></label>
                <label><span>y</span><input type="number" min="0" class="inline-edit"
                       [value]="iw.layout.y ?? 0"
                       (change)="onLayoutChange(iw.instanceId, 'y', $event)"></label>
                <label><span>w</span><input type="number" min="1" max="12" class="inline-edit"
                       [value]="iw.layout.w ?? 12"
                       (change)="onLayoutChange(iw.instanceId, 'w', $event)"></label>
                <label><span>h</span><input type="number" min="1" class="inline-edit"
                       [value]="iw.layout.h ?? ''"
                       placeholder="auto"
                       (change)="onLayoutChange(iw.instanceId, 'h', $event)"></label>
              </div>
              <div class="layout-actions">
                <button type="button" class="btn-mini" (click)="moveWidget(iw.instanceId, 'up')" title="Na górę o 1 row">↑</button>
                <button type="button" class="btn-mini" (click)="moveWidget(iw.instanceId, 'down')" title="W dół o 1 row">↓</button>
                <button type="button" class="btn-mini" (click)="resizeFull(iw.instanceId)" title="Full width 12-col">↔ full</button>
                <button type="button" class="btn-mini" (click)="resizeHalf(iw.instanceId)" title="Połowa width">½</button>
              </div>
            } @else {
              <dl>
                <dt>x/y</dt><dd>{{ iw.layout.x ?? 0 }} / {{ iw.layout.y ?? 0 }}</dd>
                <dt>w/h</dt><dd>{{ iw.layout.w ?? '—' }} / {{ iw.layout.h ?? 'auto' }}</dd>
              </dl>
            }
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
            <div class="inspector-section">Strona {{ editMode() ? '(edytuj)' : '' }}</div>
            <dl>
              <dt>id</dt>
              <dd><code>{{ sp.id }}</code></dd>
              <dt>title</dt>
              <dd>
                @if (editMode()) {
                  <input type="text" class="inline-edit"
                         [value]="sp.title"
                         (change)="onTitleChange($event)" />
                } @else {
                  <code>{{ sp.title }}</code>
                }
              </dd>
              <dt>route</dt>
              <dd><code>{{ sp.route }}</code></dd>
            </dl>
          </div>
          <div class="inspector-block">
            <div class="inspector-section">
              Widgety strony
              <span class="count-pill">{{ pageWidgets().length }}</span>
              @if (editMode()) {
                <span class="hint-mini">↕ przeciągaj by zmienić kolejność</span>
              }
            </div>
            <div class="widget-list" (dragover)="$event.preventDefault()">
              @for (w of pageWidgets(); track w.instanceId; let wi = $index) {
                <button type="button" class="widget-list-item"
                        [class.active]="inspectedInstanceId() === w.instanceId"
                        [class.drag-over]="dragOverWidgetIdx() === wi"
                        [class.dragging]="draggingWidgetIdx() === wi"
                        [attr.draggable]="editMode() ? 'true' : null"
                        (click)="inspectedInstanceId.set(w.instanceId)"
                        (dragstart)="onWidgetDragStart(wi, $event)"
                        (dragover)="onWidgetDragOver(wi, $event)"
                        (dragleave)="onWidgetDragLeave(wi)"
                        (drop)="onWidgetDrop(wi, $event)"
                        (dragend)="onWidgetDragEnd()">
                  @if (editMode()) { <span class="drag-handle">⋮⋮</span> }
                  <span class="wli-id">{{ w.instanceId }}</span>
                  <span class="wli-type">{{ w.type }}</span>
                </button>
              }
              @if (pageWidgets().length === 0) {
                <div class="muted small">Strona nie ma widgetów</div>
              }
            </div>
          </div>

          <div class="inspector-block">
            <div class="inspector-section">
              Datasources
              <span class="count-pill">{{ pageDatasources().length }}</span>
              <a routerLink="/designer/datasources" class="btn-mini" title="Edycja / test / create w dedykowanej sekcji">↗ DS Designer</a>
            </div>
            <div class="widget-list">
              @for (ds of pageDatasources(); track ds.id) {
                <div class="ds-row">
                  <div class="ds-main">
                    <span class="wli-id">{{ ds.id }}</span>
                    <span class="wli-type">{{ ds.kind }}{{ ds.transport ? ' : ' + ds.transport : '' }}{{ ds.endpoint ? ' → ' + ds.endpoint : '' }}</span>
                  </div>
                </div>
              }
              @if (pageDatasources().length === 0) {
                <div class="muted small">Brak datasources — dodaj w <a routerLink="/designer/datasources">Data Sources Designer</a></div>
              }
            </div>
          </div>

          <div class="inspector-block">
            <div class="inspector-section">
              Computed
              <span class="count-pill">{{ pageComputed().length }}</span>
              @if (editMode()) {
                <button type="button" class="btn-mini" (click)="addComputed()" title="Dodaj computed">+ fn</button>
              }
            </div>
            <div class="widget-list">
              @for (c of pageComputed(); track c.id) {
                <div class="ds-row">
                  <div class="ds-main">
                    <span class="wli-id">{{ c.id }}</span>
                    <span class="wli-type">{{ c.fn || 'expr' }} ← [{{ c.deps.join(', ') || '—' }}]</span>
                  </div>
                  @if (editMode()) {
                    <button type="button" class="btn-rm" (click)="removeComputed(c.id)" title="Usuń">✕</button>
                  }
                </div>
              }
              @if (pageComputed().length === 0) {
                <div class="muted small">Brak computed na stronie</div>
              }
            </div>
          </div>

          <div class="inspector-block">
            <div class="inspector-section">
              Event handlers
              <span class="count-pill">{{ pageHandlers().length }}</span>
              @if (editMode()) {
                <button type="button" class="btn-mini" (click)="addHandler()" title="Dodaj handler">+ handler</button>
              }
            </div>
            <div class="handler-list">
              @for (h of pageHandlers(); track h.handlerId) {
                <div class="handler-card" [class.expanded]="expandedHandlerId() === h.handlerId">
                  <div class="handler-header" (click)="toggleHandler(h.handlerId)">
                    <span class="handler-caret">{{ expandedHandlerId() === h.handlerId ? '▾' : '▸' }}</span>
                    <span class="wli-id">{{ h.on }}</span>
                    <span class="count-pill">{{ h.actions.length }} akcji</span>
                    @if (editMode()) {
                      <button type="button" class="btn-rm" (click)="removeHandler(h.handlerId); $event.stopPropagation()" title="Usuń">✕</button>
                    }
                  </div>
                  @if (expandedHandlerId() === h.handlerId) {
                    <div class="handler-body">
                      @if (editMode()) {
                        <div class="event-on-row">
                          <label class="form-label-inline">event name</label>
                          <input type="text" class="inline-edit" [value]="h.on"
                                 (change)="onHandlerEventChange(h.handlerId, $event)" />
                        </div>
                      }
                      <div class="action-chain">
                        @for (a of h.actions; track a.idx) {
                          <div class="action-card">
                            <div class="action-header">
                              <span class="action-type">{{ a.type }}</span>
                              <span class="action-value">{{ a.value }}</span>
                              @if (editMode()) {
                                <span class="action-controls">
                                  <button type="button" class="btn-tiny" (click)="moveAction(h.handlerId, a.idx, -1)" title="Do góry">↑</button>
                                  <button type="button" class="btn-tiny" (click)="moveAction(h.handlerId, a.idx, 1)" title="W dół">↓</button>
                                  <button type="button" class="btn-tiny" (click)="editAction(h.handlerId, a.idx)" title="Edytuj">✎</button>
                                  <button type="button" class="btn-tiny danger" (click)="removeAction(h.handlerId, a.idx)" title="Usuń">✕</button>
                                </span>
                              }
                            </div>
                          </div>
                        }
                        @if (h.actions.length === 0) {
                          <div class="muted small">Handler bez akcji — dodaj jedną poniżej</div>
                        }
                      </div>
                      @if (editMode()) {
                        <div class="action-add-row">
                          <select #actionTypeSelect class="inline-edit">
                            <option value="emit">emit (eventBus)</option>
                            <option value="setDatasource">setDatasource</option>
                            <option value="clearDatasource">clearDatasource</option>
                            <option value="callComputed">callComputed</option>
                            <option value="fetch">fetch</option>
                            <option value="call">call (function)</option>
                          </select>
                          <button type="button" class="btn-primary small" (click)="addAction(h.handlerId, actionTypeSelect.value)">+ action</button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
              @if (pageHandlers().length === 0) {
                <div class="muted small">Brak handlerów na stronie</div>
              }
            </div>
          </div>
        } @else {
          <div class="placeholder">Wybierz stronę</div>
        }
      </aside>
    </div>

    @if (dsDialogOpen()) {
      <div class="modal-backdrop" (click)="closeDsDialog()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span>📦 {{ dsEditingId() ? 'Edytuj' : 'Nowy' }} datasource</span>
            <button type="button" class="btn-close" (click)="closeDsDialog()">✕</button>
          </div>
          <div class="modal-body">
            <label class="form-label">
              <span>ID</span>
              <input type="text" class="inline-edit" placeholder="np. clientsList"
                     [value]="dsFormId()" (input)="dsFormId.set(($any($event.target)).value)" />
              <small class="muted">Użyte w bindingach jako <code>$ds.{{ dsFormId() || 'id' }}</code></small>
            </label>

            <label class="form-label">
              <span>Kind</span>
              <select class="inline-edit" [value]="dsFormKind()" (change)="dsFormKind.set(($any($event.target)).value)">
                <option value="value">💎 wartość (string / number / boolean / JSON)</option>
                <option value="transport">transport (HTTP / WebSocket / mock)</option>
                <option value="static">static (JSON z URL / fixture)</option>
                <option value="local">local (w pamięci, JSON)</option>
                <option value="computed">computed (derived z innych)</option>
              </select>
            </label>

            @if (dsFormKind() === 'value') {
              <label class="form-label">
                <span>Typ</span>
                <select class="inline-edit" [value]="dsFormValueType()" (change)="dsFormValueType.set(($any($event.target)).value)">
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="json">JSON (object / array)</option>
                </select>
              </label>
              @if (dsFormValueType() === 'boolean') {
                <label class="form-label">
                  <span>Wartość</span>
                  <select class="inline-edit" [value]="dsFormValueInput()" (change)="dsFormValueInput.set(($any($event.target)).value)">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
              } @else if (dsFormValueType() === 'json') {
                <label class="form-label">
                  <span>Wartość (JSON)</span>
                  <input type="text" class="inline-edit" placeholder='{"items": []} albo [1,2,3]'
                         [value]="dsFormValueInput()" (input)="dsFormValueInput.set(($any($event.target)).value)" />
                  <small class="muted">Musi być poprawny JSON — cudzysłowy dla kluczy/wartości string</small>
                </label>
              } @else {
                <label class="form-label">
                  <span>Wartość</span>
                  <input [type]="dsFormValueType() === 'number' ? 'number' : 'text'"
                         class="inline-edit"
                         [placeholder]="dsFormValueType() === 'number' ? 'np. 42' : 'np. Alice'"
                         [value]="dsFormValueInput()" (input)="dsFormValueInput.set(($any($event.target)).value)" />
                </label>
              }
              <small class="muted form-hint">Wartość dostępna jako <code>$ds.{{ dsFormId() || 'id' }}</code> — np. do bind tytułu, user name, threshold liczbowy, flag itp.</small>
            }

            @if (dsFormKind() === 'transport') {
              <label class="form-label">
                <span>Transport</span>
                <select class="inline-edit" [value]="dsFormTransport()" (change)="dsFormTransport.set(($any($event.target)).value)">
                  <option value="http">http</option>
                  <option value="ws">ws (WebSocket)</option>
                  <option value="mock">mock (testowy)</option>
                </select>
              </label>
              <label class="form-label">
                <span>Endpoint / Channel</span>
                <input type="text" class="inline-edit"
                       [placeholder]="dsFormTransport() === 'ws' ? 'np. live/quotes' : 'np. api/clients'"
                       [value]="dsFormEndpoint()" (input)="dsFormEndpoint.set(($any($event.target)).value)" />
              </label>
            }

            @if (dsFormKind() === 'static') {
              <label class="form-label">
                <span>URL do JSON</span>
                <input type="text" class="inline-edit" placeholder="/assets/fixtures/clients.json"
                       [value]="dsFormStaticUrl()" (input)="dsFormStaticUrl.set(($any($event.target)).value)" />
                <small class="muted">Klasyczny wzorzec dla fixtures / static data</small>
              </label>
            }

            @if (dsFormKind() === 'local') {
              <label class="form-label">
                <span>Initial value (JSON — opcjonalne)</span>
                <input type="text" class="inline-edit" placeholder='np. {"items": []}'
                       [value]="dsFormInitial()" (input)="dsFormInitial.set(($any($event.target)).value)" />
                <small class="muted">Wartość początkowa state-u (parsed jako JSON, fallback na string)</small>
              </label>
            }

            @if (dsFormKind() === 'computed') {
              <label class="form-label">
                <span>Function name</span>
                <input type="text" class="inline-edit" placeholder="np. searchRows"
                       [value]="dsFormFn()" (input)="dsFormFn.set(($any($event.target)).value)" />
                <small class="muted">Zarejestrowana w functions/ lub z functions-core</small>
              </label>
              <label class="form-label">
                <span>Inputs (comma-separated)</span>
                <input type="text" class="inline-edit" placeholder="np. clientsList, searchTerm"
                       [value]="dsFormInputs()" (input)="dsFormInputs.set(($any($event.target)).value)" />
              </label>
            }

            @if (dsFormError()) {
              <div class="form-error">{{ dsFormError() }}</div>
            }
            <div class="save-actions">
              <button type="button" class="btn-primary" (click)="submitDsForm()">
                {{ dsEditingId() ? '💾 Zapisz' : '✨ Stwórz' }}
              </button>
              <button type="button" class="btn-mini" (click)="closeDsDialog()">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    }

    @if (newPageDialogOpen()) {
      <div class="modal-backdrop" (click)="closeNewPageDialog()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span>➕ Nowa strona</span>
            <button type="button" class="btn-close" (click)="closeNewPageDialog()">✕</button>
          </div>
          <div class="modal-body">
            <label class="form-label">
              <span>Page ID</span>
              <input #newIdInput type="text" class="inline-edit" placeholder="np. my-new-page"
                     [value]="newPageId()" (input)="onNewIdInput($event)" />
              <small class="muted">Używane do route i nazwy klasy. Tylko lowercase + myślnik.</small>
            </label>
            <label class="form-label">
              <span>Tytuł</span>
              <input type="text" class="inline-edit" placeholder="np. My New Page"
                     [value]="newPageTitle()" (input)="newPageTitle.set(($any($event.target)).value)" />
            </label>
            <label class="form-label">
              <span>Route</span>
              <input type="text" class="inline-edit" placeholder="/my-new-page"
                     [value]="newPageRoute()" (input)="newPageRoute.set(($any($event.target)).value)" />
            </label>
            <label class="form-label">
              <span>Template</span>
              <select class="inline-edit" [value]="newPageTemplate()" (change)="newPageTemplate.set(($any($event.target)).value)">
                <option value="empty">Empty (tylko page-title)</option>
                <option value="list">List + Detail (lewa/prawa)</option>
                <option value="dashboard">Dashboard (3 stat-tile na górze)</option>
                <option value="form">Form (validated-form + actions-bar)</option>
              </select>
            </label>
            @if (newPageError()) {
              <div class="form-error">{{ newPageError() }}</div>
            }
            <div class="save-actions">
              <button type="button" class="btn-primary" (click)="createNewPage()">✨ Stwórz draft</button>
              <button type="button" class="btn-mini" (click)="closeNewPageDialog()">Cancel</button>
            </div>
            <div class="save-roadmap">
              Nowa strona jest <strong>draftem w pamięci</strong>. Żeby ją zcommitować do
              kodu: po stworzeniu kliknij 💾 Save i wklej wygenerowany plik do
              <code>src/app/pages/{{ newPageId() }}.page.ts</code> + dodaj import w
              <code>bootstrap/pages.ts</code>.
            </div>
          </div>
        </div>
      </div>
    }

    @if (saveDialogOpen()) {
      <div class="modal-backdrop" (click)="closeSaveDialog()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span>💾 Save to .page.ts</span>
            <button type="button" class="btn-close" (click)="closeSaveDialog()">✕</button>
          </div>
          <div class="modal-body">
            <p class="muted small">
              Faza 2 MVP — designer nie ma jeszcze write-back API (REST + ts-morph).
              W międzyczasie kopiujesz source poniżej i ręcznie wklejasz do pliku.
            </p>
            <div class="save-target">
              <div class="save-target-line">
                <span class="muted">Target file:</span>
                <code>src/app/pages/{{ selectedPage()?.id }}.page.ts</code>
              </div>
              <div class="save-target-line">
                <span class="muted">Class:</span>
                <code>{{ selectedPage()?.sourceClassName }}</code>
              </div>
              <div class="save-target-line">
                <span class="muted">Method:</span>
                <span>Zamień <code>static readonly config</code> na wygenerowany below</span>
              </div>
            </div>
            <pre class="save-preview"><code [innerHTML]="highlightedSaveSource()"></code></pre>
            <div class="save-actions">
              <button type="button" class="btn-primary" (click)="copySaveSource()">📋 Kopiuj cały plik</button>
              <button type="button" class="btn-primary" (click)="copyConfigOnly()">📋 Kopiuj tylko config</button>
              @if (saveCopied()) { <span class="save-copied">✓ Skopiowano!</span> }
            </div>
            <div class="save-roadmap">
              <strong>📋 Roadmap Faza 2 (M13+):</strong> dev-only REST endpoint +
              <code>ts-morph</code> AST merge — zapisuje tylko <code>config</code>,
              zachowuje importy/komentarze/metody klasy. Dzisiaj musisz wkleić ręcznie.
            </div>
          </div>
        </div>
      </div>
    }
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
      background: var(--ech-panel-alt, #111827);
      border: 1px solid var(--ech-border, #1f2937);
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
      border-bottom: 1px solid var(--ech-border, #1f2937);
      background: var(--ech-panel, #0f172a);
      flex-wrap: wrap;
    }
    .canvas-area { flex: 1; padding: 16px; overflow: auto; min-height: 0; }
    h3 {
      margin: 0 0 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ech-muted, #9ca3af);
      font-weight: 600;
    }
    .placeholder, .placeholder-inline {
      color: var(--ech-muted, #6b7280);
      font-size: 12px;
      font-style: italic;
    }
    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      border: 1px dashed var(--ech-border, #374151);
      border-radius: 4px;
      text-align: center;
      min-height: 60px;
      line-height: 1.4;
    }
    .canvas-area .placeholder { min-height: 200px; }

    .picker { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .picker span { color: var(--ech-muted, #9ca3af); }
    .picker select { padding: 6px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 4px; font-size: 13px; min-width: 240px; cursor: pointer; }

    .breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ech-muted, #9ca3af); flex-wrap: wrap; }
    .crumb { padding: 2px 8px; background: var(--ech-panel-alt); border-radius: 3px; font-family: var(--ech-font-mono); }
    .crumb.class { color: var(--ech-accent); }
    .crumb.id { color: var(--ech-accent); }
    .crumb.route { color: var(--ech-success); }
    .sep { color: var(--ech-muted, #6b7280); }

    .meta { margin-left: auto; display: flex; gap: 10px; font-size: 12px; color: var(--ech-muted, #9ca3af); }
    .meta span { display: flex; align-items: center; gap: 4px; }
    .meta .ic { font-size: 13px; }

    .preview-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--ech-panel-alt); border: 1px solid var(--ech-border, #374151); border-bottom: none; border-radius: 4px 4px 0 0; font-size: 12px; }
    .preview-mode { color: var(--ech-muted, #9ca3af); }
    .preview-actions { display: flex; gap: 6px; }
    .preview-actions button, .preview-actions a { padding: 3px 8px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; text-decoration: none; }
    .preview-actions button:hover, .preview-actions a:hover { border-color: var(--ech-accent); }

    .preview-frame { position: relative; width: 100%; flex: 1; min-height: 500px; border: 1px solid var(--ech-border, #374151); border-radius: 0 0 4px 4px; overflow: hidden; background: #fff; }
    .preview-frame iframe { width: 100%; height: 100%; min-height: 500px; border: none; display: block; background: var(--ech-panel, #0f172a); }
    .preview-frame.loading iframe { opacity: 0.3; }
    .preview-spinner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--ech-muted, #9ca3af); background: rgba(15, 23, 42, 0.6); }

    .palette-count, .palette-group-count { background: var(--ech-panel-alt); color: var(--ech-muted, #9ca3af); font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 4px; font-weight: normal; }
    .palette-filter { width: 100%; padding: 6px 10px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 4px; font-size: 12px; margin-bottom: 10px; box-sizing: border-box; }
    .palette-filter:focus { outline: none; border-color: var(--ech-accent); }
    .palette-group { margin-bottom: 10px; }
    .palette-group-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ech-muted, #6b7280); margin-bottom: 4px; font-weight: 600; }
    .palette-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px; background: transparent; border: 1px solid transparent; color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; text-align: left; margin-bottom: 2px; font-family: inherit; }
    .palette-item:hover { background: var(--ech-panel-alt); border-color: var(--ech-border, #374151); }
    .palette-item.active { background: color-mix(in srgb, var(--ech-accent) 15%, transparent); border-color: var(--ech-accent); }
    .p-icon { width: 16px; text-align: center; font-size: 13px; }
    .p-name { flex: 1; font-family: var(--ech-font-mono); font-size: 11px; color: var(--ech-accent); }
    .p-version { font-size: 9px; color: var(--ech-muted, #6b7280); }

    .inspector-block { padding: 10px 12px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-radius: 4px; margin-bottom: 8px; }
    .inspector-title { font-size: 13px; font-weight: 600; color: var(--ech-accent); font-family: var(--ech-font-mono); }
    .inspector-subtitle { font-size: 11px; color: var(--ech-accent); margin-top: 2px; font-family: var(--ech-font-mono); }
    .inspector-desc { font-size: 11px; color: var(--ech-muted, #9ca3af); margin-top: 6px; line-height: 1.4; font-style: italic; }
    .inspector-section { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ech-muted, #6b7280); margin-bottom: 6px; font-weight: 600; }
    .inspector-block dl { display: grid; grid-template-columns: 90px 1fr; gap: 3px 8px; margin: 0; font-size: 11px; }
    .inspector-block dt { color: var(--ech-muted, #9ca3af); font-family: var(--ech-font-mono); }
    .inspector-block dd { margin: 0; color: var(--ech-fg, #e5e7eb); word-break: break-word; }
    .inspector-block code, .when { background: var(--ech-panel-alt); padding: 1px 4px; border-radius: 2px; font-size: 10px; color: var(--ech-warning); }
    .when { display: block; padding: 6px; word-break: break-all; }
    .muted { color: var(--ech-muted, #9ca3af); }
    .small { font-size: 11px; }
    .widget-list { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
    .widget-list-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; background: transparent; border: 1px solid transparent; color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 11px; cursor: pointer; text-align: left; font-family: inherit; }
    .widget-list-item:hover { background: var(--ech-panel-alt); border-color: var(--ech-border, #374151); }
    .widget-list-item.active { background: color-mix(in srgb, var(--ech-accent) 15%, transparent); border-color: var(--ech-accent); }
    .wli-id { flex: 1; font-family: var(--ech-font-mono); color: var(--ech-accent); }
    .wli-type { font-family: var(--ech-font-mono); color: var(--ech-accent); font-size: 10px; }
    .source-link { display: flex; gap: 6px; align-items: center; font-size: 11px; }

    .tabs { display: flex; gap: 4px; }
    .tab { padding: 4px 10px; background: transparent; border: 1px solid transparent; color: var(--ech-muted, #9ca3af); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .tab:hover { color: var(--ech-fg, #e5e7eb); background: var(--ech-panel-alt); }
    .tab.active { background: var(--ech-panel, #0f172a); border-color: var(--ech-accent); color: var(--ech-accent); }
    .src-size { font-size: 11px; margin-left: 8px; }

    .source-view { width: 100%; flex: 1; min-height: 500px; border: 1px solid var(--ech-border, #374151); border-radius: 0 0 4px 4px; overflow: auto; background: var(--ech-bg); }
    .source-view pre { margin: 0; padding: 16px; font-size: 12px; line-height: 1.6; color: var(--ech-fg); font-family: var(--ech-font-mono); tab-size: 2; }
    .source-view code { background: transparent; padding: 0; font-size: inherit; color: inherit; }
    .tk-kw { color: var(--ech-accent); }
    .tk-str { color: var(--ech-success); }
    .tk-num { color: var(--ech-warning); }
    .tk-com { color: var(--ech-muted); font-style: italic; }
    .tk-dec { color: var(--ech-warning); }
    .tk-key { color: var(--ech-accent); }

    .edit-controls { display: flex; gap: 4px; margin-left: 10px; }
    .btn-edit, .btn-undo, .btn-redo { padding: 4px 10px; background: transparent; border: 1px solid var(--ech-border, #374151); color: var(--ech-muted, #9ca3af); border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; }
    .btn-edit:hover, .btn-undo:hover:not(:disabled), .btn-redo:hover:not(:disabled) { border-color: var(--ech-accent); color: var(--ech-fg, #e5e7eb); }
    .btn-edit.on { background: color-mix(in srgb, var(--ech-success) 20%, var(--ech-panel)); border-color: var(--ech-success); color: var(--ech-success); }
    .btn-undo:disabled, .btn-redo:disabled { opacity: 0.3; cursor: not-allowed; }

    .inline-edit { width: 100%; padding: 3px 6px; background: var(--ech-bg); border: 1px solid var(--ech-accent); color: var(--ech-fg, #e5e7eb); border-radius: 2px; font-size: 11px; font-family: var(--ech-font-mono); box-sizing: border-box; }
    .inline-edit:focus { outline: none; border-color: var(--ech-accent); box-shadow: 0 0 0 1px #93c5fd44; }
    .inline-edit.full { width: 100%; }

    .bind-row { display: flex; gap: 4px; align-items: center; }
    .btn-mini { padding: 1px 6px; font-size: 9px; background: var(--ech-panel-alt); border: 1px solid var(--ech-border, #374151); color: var(--ech-muted, #9ca3af); border-radius: 2px; cursor: pointer; font-family: inherit; margin-left: 6px; }
    .btn-mini:hover { border-color: var(--ech-accent); color: var(--ech-fg, #e5e7eb); }
    .btn-rm { padding: 0 4px; font-size: 10px; background: transparent; border: none; color: var(--ech-danger); cursor: pointer; opacity: 0.6; }
    .btn-rm:hover { opacity: 1; }

    .palette-hint { font-size: 10px; color: var(--ech-success); padding: 4px 6px; background: color-mix(in srgb, var(--ech-success) 15%, transparent); border-radius: 3px; margin-bottom: 8px; text-align: center; }
    .palette-hint.muted-hint { color: var(--ech-muted, #9ca3af); background: var(--ech-panel-alt); }
    .palette-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .palette-item:disabled:hover { background: transparent; border-color: transparent; }

    .inspector-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .btn-danger { padding: 4px 10px; background: color-mix(in srgb, var(--ech-danger) 10%, transparent); border: 1px solid var(--ech-danger); color: var(--ech-danger); border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; flex-shrink: 0; }
    .btn-danger:hover { background: color-mix(in srgb, var(--ech-danger) 20%, transparent); }

    .shortcuts-help { margin: -4px 0 12px; padding: 6px 10px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-radius: 4px; font-size: 10px; }
    .shortcuts-help summary { cursor: pointer; color: var(--ech-muted, #9ca3af); user-select: none; font-size: 11px; }
    .shortcuts-help summary:hover { color: var(--ech-fg, #e5e7eb); }
    .shortcuts-help dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 8px 0 0; }
    .shortcuts-help dt { white-space: nowrap; color: var(--ech-muted, #9ca3af); }
    .shortcuts-help dd { margin: 0; color: var(--ech-fg, #e5e7eb); }
    kbd { display: inline-block; padding: 1px 5px; background: var(--ech-panel-alt); border: 1px solid var(--ech-border, #374151); border-radius: 2px; font-size: 10px; font-family: var(--ech-font-mono); color: var(--ech-accent); }
    kbd + kbd { margin-left: 1px; }

    .layout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
    .layout-grid label { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--ech-muted, #9ca3af); }
    .layout-grid input { width: 100%; }
    .layout-actions { display: flex; gap: 3px; flex-wrap: wrap; }

    .btn-save { padding: 4px 10px; background: color-mix(in srgb, var(--ech-success) 15%, transparent); border: 1px solid var(--ech-success); color: var(--ech-success); border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; }
    .btn-save:hover:not(:disabled) { background: color-mix(in srgb, var(--ech-success) 30%, transparent); }
    .btn-save:disabled { opacity: 0.3; cursor: not-allowed; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-radius: 6px; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--ech-border, #1f2937); font-weight: 600; color: var(--ech-accent, #58a6ff); }
    .btn-close { background: transparent; border: none; color: var(--ech-muted, #9ca3af); font-size: 16px; cursor: pointer; padding: 2px 6px; }
    .btn-close:hover { color: var(--ech-fg, #e5e7eb); }
    .modal-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .save-target { background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #1f2937); border-radius: 4px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
    .save-target-line { display: flex; gap: 8px; align-items: center; }
    .save-target code { background: var(--ech-panel-alt); padding: 2px 6px; border-radius: 2px; color: var(--ech-accent); font-size: 11px; }
    .save-preview { margin: 0; padding: 12px; background: var(--ech-bg); border: 1px solid var(--ech-border, #1f2937); border-radius: 4px; font-size: 11px; line-height: 1.5; color: var(--ech-fg); max-height: 400px; overflow: auto; }
    .save-actions { display: flex; gap: 8px; align-items: center; }
    .btn-primary { padding: 6px 14px; background: color-mix(in srgb, var(--ech-accent) 25%, var(--ech-panel)); border: 1px solid var(--ech-accent); color: var(--ech-info); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-primary:hover { background: color-mix(in srgb, var(--ech-accent) 40%, var(--ech-panel)); }
    .save-copied { color: var(--ech-success); font-size: 12px; font-weight: 600; animation: flash 0.3s; }
    @keyframes flash { from { opacity: 0; } to { opacity: 1; } }
    .save-roadmap { padding: 10px 12px; background: color-mix(in srgb, var(--ech-warning) 15%, transparent); border-left: 3px solid var(--ech-warning); border-radius: 2px; font-size: 11px; color: var(--ech-warning); }
    .save-roadmap code { background: var(--ech-panel-alt); padding: 1px 4px; border-radius: 2px; color: var(--ech-warning); }

    .btn-new { padding: 4px 10px; background: color-mix(in srgb, var(--ech-accent) 15%, transparent); border: 1px solid var(--ech-accent); color: var(--ech-info); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; margin-left: 4px; }
    .btn-new:hover { background: color-mix(in srgb, var(--ech-accent) 25%, transparent); }

    .modal-sm { max-width: 500px; }
    .form-label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ech-muted, #9ca3af); }
    .form-label span { font-weight: 600; }
    .form-label small { font-size: 10px; font-style: italic; }
    .form-error { padding: 6px 10px; background: color-mix(in srgb, var(--ech-danger) 10%, transparent); border: 1px solid var(--ech-danger); color: var(--ech-danger); border-radius: 3px; font-size: 12px; }
    .form-hint { font-style: italic; margin-top: -4px; }
    .form-hint code { background: var(--ech-panel-alt); padding: 1px 5px; border-radius: 2px; color: var(--ech-accent); font-size: 10px; }

    .count-pill { background: var(--ech-panel-alt); color: var(--ech-muted, #9ca3af); font-size: 9px; padding: 1px 6px; border-radius: 8px; margin-left: 4px; font-weight: normal; }
    .ro-badge { margin-left: auto; background: color-mix(in srgb, var(--ech-warning) 15%, transparent); color: var(--ech-warning); font-size: 9px; padding: 1px 6px; border-radius: 8px; font-weight: 500; }
    .ds-row { display: flex; align-items: center; gap: 4px; padding: 5px 8px; background: transparent; border: 1px solid transparent; border-radius: 3px; font-size: 11px; margin-bottom: 2px; }
    .ds-row:hover { background: var(--ech-panel-alt); border-color: var(--ech-border, #374151); }
    .ds-row.clickable { cursor: pointer; }
    .ds-main { flex: 1; display: flex; align-items: center; gap: 8px; }

    .handler-list { display: flex; flex-direction: column; gap: 6px; }
    .handler-card { background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-radius: 3px; transition: border-color 0.15s; }
    .handler-card.expanded { border-color: var(--ech-accent); }
    .handler-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer; user-select: none; }
    .handler-header:hover { background: var(--ech-panel-alt); }
    .handler-caret { font-size: 9px; color: var(--ech-muted, #6b7280); width: 10px; }
    .handler-body { padding: 0 12px 10px; border-top: 1px solid var(--ech-border, #1f2937); }

    .event-on-row { display: flex; align-items: center; gap: 6px; margin: 10px 0 12px; }
    .form-label-inline { font-size: 10px; color: var(--ech-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; min-width: 70px; }

    .action-chain { display: flex; flex-direction: column; gap: 4px; }
    .action-card { background: var(--ech-panel-alt); border-left: 2px solid var(--ech-accent); border-radius: 3px; padding: 5px 8px; font-size: 11px; }
    .action-header { display: flex; align-items: center; gap: 6px; }
    .action-type { font-weight: 600; color: var(--ech-accent); font-family: var(--ech-font-mono); font-size: 10px; background: color-mix(in srgb, var(--ech-accent) 15%, transparent); padding: 1px 6px; border-radius: 2px; }
    .action-value { flex: 1; color: var(--ech-fg); font-family: var(--ech-font-mono); word-break: break-all; }
    .action-controls { display: flex; gap: 2px; }
    .btn-tiny { padding: 0 5px; font-size: 10px; background: transparent; border: 1px solid transparent; color: var(--ech-muted, #9ca3af); border-radius: 2px; cursor: pointer; font-family: inherit; min-width: 18px; }
    .btn-tiny:hover { background: var(--ech-panel-alt); border-color: var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); }
    .btn-tiny.danger:hover { color: var(--ech-danger); border-color: var(--ech-danger); }

    .action-add-row { display: flex; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--ech-border, #1f2937); }
    .action-add-row select { flex: 1; font-size: 11px; }
    .btn-primary.small { padding: 4px 10px; font-size: 11px; }

    .form-builder-block { border-color: var(--ech-success); background: color-mix(in srgb, var(--ech-success) 5%, transparent); }
    .fb-fields { display: flex; flex-direction: column; gap: 4px; }
    .fb-field { background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-left: 2px solid #10b981; border-radius: 3px; }
    .fb-field.expanded { border-color: var(--ech-accent); border-left-color: var(--ech-success); }
    .fb-field-header { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: pointer; user-select: none; font-size: 11px; }
    .fb-field-header:hover { background: var(--ech-panel-alt); }
    .fb-caret { font-size: 9px; color: var(--ech-muted, #6b7280); width: 10px; }
    .fb-type { font-family: var(--ech-font-mono); font-size: 9px; background: color-mix(in srgb, var(--ech-success) 15%, transparent); color: var(--ech-success); padding: 1px 6px; border-radius: 2px; font-weight: 600; }
    .fb-id { flex: 1; color: var(--ech-accent); font-family: var(--ech-font-mono); font-size: 11px; }
    .fb-badge { background: color-mix(in srgb, var(--ech-danger) 30%, var(--ech-panel)); color: var(--ech-danger); font-size: 9px; padding: 1px 5px; border-radius: 2px; font-weight: 600; }
    .fb-field-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--ech-border, #1f2937); background: var(--ech-bg); }
    .fb-label { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--ech-muted, #9ca3af); }
    .fb-label span { text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .fb-label-small { font-size: 10px; color: var(--ech-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .fb-inline { display: flex; gap: 12px; }
    .fb-check { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ech-fg, #e5e7eb); cursor: pointer; }
    .fb-check input { margin: 0; }
    .fb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .fb-validators { padding-top: 6px; border-top: 1px dashed var(--ech-border, #1f2937); }

    .draft-preview-notice { width: 100%; flex: 1; min-height: 500px; background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #374151); border-radius: 0 0 4px 4px; padding: 40px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
    .draft-icon { font-size: 48px; opacity: 0.6; }
    .draft-title { font-size: 16px; font-weight: 600; color: var(--ech-warning); }
    .draft-desc { font-size: 13px; color: var(--ech-muted, #9ca3af); max-width: 500px; line-height: 1.5; }
    .draft-actions { display: flex; gap: 10px; margin-top: 10px; }
    .draft-actions button { padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 4px; font-family: inherit; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); }
    .draft-actions button.primary { background: color-mix(in srgb, var(--ech-accent) 25%, var(--ech-panel)); border-color: var(--ech-accent); color: var(--ech-info); }
    .draft-actions button:hover { border-color: var(--ech-accent); }
    .draft-hint { max-width: 500px; font-size: 11px; color: var(--ech-muted, #9ca3af); text-align: left; background: var(--ech-bg); padding: 10px 14px; border-radius: 4px; border-left: 3px solid var(--ech-warning); }
    .draft-hint ol { margin: 6px 0 0; padding-left: 20px; line-height: 1.8; }
    .draft-hint code { background: var(--ech-panel-alt); padding: 1px 5px; border-radius: 2px; color: var(--ech-accent); font-size: 11px; }

    .hint-mini { margin-left: auto; font-size: 9px; color: var(--ech-muted, #6b7280); text-transform: none; letter-spacing: 0; font-weight: normal; font-style: italic; }
    .drag-handle { color: var(--ech-muted, #6b7280); cursor: grab; font-size: 10px; letter-spacing: -2px; padding: 0 4px; user-select: none; }
    .widget-list-item.dragging { opacity: 0.4; }
    .widget-list-item.drag-over { background: color-mix(in srgb, var(--ech-accent) 25%, transparent); border-top: 2px solid var(--ech-accent); }
    .palette-item.dragging { opacity: 0.4; }
    .palette-item[draggable="true"] { cursor: grab; }
    .palette-item[draggable="true"]:active { cursor: grabbing; }

    .canvas-drop-zone {
      position: absolute; inset: 0; z-index: 10;
      display: flex; align-items: center; justify-content: center;
      background: rgba(30, 58, 95, 0.85);
      border: 3px dashed var(--ech-accent);
      backdrop-filter: blur(2px);
      pointer-events: auto;
      border-radius: 0 0 4px 4px;
    }
    .drop-hint {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 30px 40px; background: var(--ech-panel);
      border: 1px solid var(--ech-accent); border-radius: 6px;
      box-shadow: 0 4px 20px rgba(88, 166, 255, 0.3);
    }
    .drop-icon { font-size: 32px; }
    .drop-label { font-size: 14px; color: var(--ech-fg, #e5e7eb); font-weight: 500; }
    .drop-type { font-family: var(--ech-font-mono); font-size: 12px; color: var(--ech-accent); background: var(--ech-panel-alt); padding: 3px 10px; border-radius: 3px; }

    /* Canvas: 12-col + rows layout identyczny z real pages */
    .layout-canvas {
      position: relative; width: 100%; flex: 1; min-height: 500px;
      border: 1px solid var(--ech-border, #374151); border-radius: 0 0 4px 4px;
      background: var(--ech-bg);
      padding: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }
    .layout-canvas.drop-active { border-color: var(--ech-accent); background-color: #1e3a5f11; }

    /* Ruler — 12 column markers u góry */
    .col-ruler {
      display: grid;
      grid-template-columns: 32px repeat(12, 1fr);
      height: 22px;
      background: var(--ech-panel-alt);
      border-bottom: 1px solid var(--ech-border, #1f2937);
      position: sticky;
      top: 0;
      z-index: 5;
    }
    .col-ruler::before { content: ''; grid-column: 1 / 2; border-right: 1px solid var(--ech-border, #1f2937); }
    .col-tick {
      font-size: 10px; color: var(--ech-muted, #6b7280); text-align: center; padding-top: 4px;
      border-right: 1px solid var(--ech-border, #1f2937); font-family: var(--ech-font-mono);
    }
    .col-tick:last-child { border-right: none; }

    .canvas-body { display: flex; flex: 1; min-height: 0; }

    /* Row numbers po lewej */
    .row-ruler {
      width: 32px; background: var(--ech-panel-alt); border-right: 1px solid var(--ech-border, #1f2937);
      display: flex; flex-direction: column;
      flex-shrink: 0;
    }
    .row-tick {
      height: 80px; display: flex; align-items: flex-start; justify-content: center; padding-top: 4px;
      font-size: 10px; color: var(--ech-muted, #6b7280); font-family: var(--ech-font-mono);
      border-bottom: 1px solid var(--ech-border, #1f2937);
    }

    .layout-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 6px;
      padding: 6px;
      flex: 1;
      min-width: 0;
      /* Grid lines overlay — wertykalne + horyzontalne, idealnie pasujące */
      background-image:
        linear-gradient(to right, var(--ech-border) 1px, transparent 1px),
        linear-gradient(to bottom, var(--ech-border) 1px, transparent 1px);
      background-size: calc((100% - 12px) / 12) 80px, 100% 80px;
      background-position: 6px 0, 0 0;
      background-repeat: repeat-x, repeat-y;
    }

    .primitive-card {
      background: var(--ech-panel-alt);
      border: 1.5px solid var(--ech-border);
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.08s;
      overflow: hidden;
    }
    .primitive-card:hover { border-color: var(--ech-accent); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(88,166,255,0.15); }
    .primitive-card.active { border-color: var(--ech-accent); background: color-mix(in srgb, var(--ech-accent) 15%, transparent); box-shadow: 0 0 0 2px #58a6ff44; }
    .primitive-card.required-empty { border-color: var(--ech-danger); background: color-mix(in srgb, var(--ech-danger) 30%, var(--ech-panel))11; }
    .primitive-card.required-empty::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: repeating-linear-gradient(45deg, var(--ech-danger), var(--ech-danger) 4px, color-mix(in srgb, var(--ech-danger) 30%, var(--ech-panel)) 4px, color-mix(in srgb, var(--ech-danger) 30%, var(--ech-panel)) 8px);
    }
    .primitive-card[draggable="true"] { cursor: grab; }
    .primitive-card[draggable="true"]:active { cursor: grabbing; }

    .prim-top { display: flex; align-items: center; gap: 6px; font-size: 11px; }
    .prim-icon { font-size: 16px; }
    .prim-type { flex: 1; font-family: var(--ech-font-mono); font-size: 10px; color: var(--ech-accent); font-weight: 600; }
    .prim-dim { font-family: var(--ech-font-mono); font-size: 10px; color: var(--ech-muted, #6b7280); background: var(--ech-bg); padding: 1px 6px; border-radius: 2px; font-weight: 600; }

    .prim-center { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 3px; min-width: 0; }
    .prim-id { font-size: 13px; font-weight: 700; color: var(--ech-fg, #e5e7eb); font-family: var(--ech-font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .prim-bindings { display: flex; flex-wrap: wrap; gap: 2px; max-height: 40px; overflow: hidden; }
    .prim-bind { font-size: 9px; font-family: var(--ech-font-mono); background: color-mix(in srgb, var(--ech-success) 15%, transparent); padding: 1px 5px; border-radius: 2px; display: inline-flex; gap: 2px; max-width: 100%; }
    .prim-bind .b-key { color: var(--ech-success); font-weight: 600; }
    .prim-bind .b-val { color: var(--ech-success); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
    .prim-warning { font-size: 9px; color: var(--ech-danger); font-weight: 600; margin-top: 2px; }

    /* Container widget — visual: dashed border + specjalne tło */
    .primitive-card.is-container {
      border-style: dashed;
      border-width: 2px;
      border-color: var(--ech-accent);
      background: linear-gradient(135deg, color-mix(in srgb, var(--ech-accent) 5%, transparent) 0%, var(--ech-panel-alt) 100%);
    }
    .primitive-card.is-container:hover { border-color: var(--ech-accent); }
    .primitive-card.is-container.active { border-color: var(--ech-accent); background: color-mix(in srgb, var(--ech-accent) 15%, transparent); }
    .container-enter { background: color-mix(in srgb, var(--ech-accent) 15%, transparent); border-color: var(--ech-accent); color: #ddd6fe; }
    .container-enter:hover { background: color-mix(in srgb, var(--ech-accent) 30%, transparent); }

    /* Scope breadcrumb — widoczny gdy wszedł do container */
    .scope-breadcrumb { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: color-mix(in srgb, var(--ech-accent) 10%, transparent); border-bottom: 1px solid var(--ech-accent); font-size: 12px; }
    .scope-crumb { background: transparent; border: 1px solid transparent; padding: 3px 8px; border-radius: 3px; color: var(--ech-fg, #e5e7eb); font-size: 12px; cursor: pointer; font-family: inherit; }
    .scope-crumb:hover { background: var(--ech-panel-alt); border-color: var(--ech-border, #374151); }
    .scope-crumb.current { background: color-mix(in srgb, var(--ech-accent) 15%, transparent); border-color: var(--ech-accent); color: #ddd6fe; font-weight: 600; cursor: default; }
    .scope-sep { color: var(--ech-muted, #6b7280); font-size: 14px; }
    .scope-exit { margin-left: auto; background: var(--ech-panel-alt); border: 1px solid var(--ech-border, #374151); padding: 3px 10px; border-radius: 3px; color: var(--ech-fg, #e5e7eb); font-size: 11px; cursor: pointer; font-family: inherit; }
    .scope-exit:hover { border-color: var(--ech-accent); }

    .prim-actions { position: absolute; top: 4px; right: 4px; display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; background: rgba(26, 35, 50, 0.9); padding: 2px; border-radius: 3px; }
    .primitive-card:hover .prim-actions, .primitive-card.active .prim-actions { opacity: 1; }

    .prim-fractions { position: absolute; bottom: 4px; left: 4px; right: 4px; display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; background: rgba(11, 17, 32, 0.95); padding: 3px; border-radius: 3px; border: 1px solid var(--ech-border, #374151); }
    .primitive-card:hover .prim-fractions, .primitive-card.active .prim-fractions { opacity: 1; }
    .frac { flex: 1; padding: 2px 0; background: transparent; border: 1px solid transparent; color: var(--ech-muted, #9ca3af); border-radius: 2px; font-size: 11px; cursor: pointer; font-family: var(--ech-font-mono); }
    .frac:hover { background: var(--ech-panel-alt); border-color: var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); }
    .frac.active { background: color-mix(in srgb, var(--ech-accent) 25%, var(--ech-panel)); border-color: var(--ech-accent); color: var(--ech-info); font-weight: 600; }

    .layout-empty { grid-column: 1 / -1; grid-row: 1 / span 4; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; gap: 10px; color: var(--ech-muted, #9ca3af); text-align: center; }
    .empty-icon { font-size: 48px; opacity: 0.4; }
    .empty-title { font-size: 16px; font-weight: 600; }
    .empty-desc { font-size: 13px; max-width: 400px; }

    .layout-drop-overlay {
      position: absolute; inset: 0; z-index: 10;
      display: flex; align-items: center; justify-content: center;
      background: rgba(30, 58, 95, 0.75);
      border: 3px dashed var(--ech-accent);
      border-radius: 0 0 4px 4px;
      pointer-events: none;
    }

    .slot-block { background: color-mix(in srgb, var(--ech-accent) 25%, var(--ech-panel))0a; border-color: var(--ech-accent); }
    .slots { display: flex; flex-direction: column; gap: 6px; }
    .slot { padding: 8px 10px; background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #374151); border-left: 3px solid var(--ech-border, #374151); border-radius: 3px; }
    .slot.filled { border-left-color: var(--ech-success); }
    .slot.required:not(.filled) { border-left-color: var(--ech-danger); }
    .slot-head { display: flex; align-items: center; gap: 6px; font-size: 11px; }
    .slot-name { font-family: var(--ech-font-mono); color: var(--ech-accent); font-weight: 600; }
    .slot-type { font-size: 9px; color: var(--ech-muted, #9ca3af); background: var(--ech-panel-alt); padding: 1px 5px; border-radius: 2px; font-family: var(--ech-font-mono); }
    .slot-req { font-size: 9px; background: color-mix(in srgb, var(--ech-danger) 30%, var(--ech-panel)); color: var(--ech-danger); padding: 1px 5px; border-radius: 2px; font-weight: 600; }
    .slot-status { margin-left: auto; color: var(--ech-success); font-weight: 600; }
    .slot-desc { font-size: 10px; color: var(--ech-muted, #6b7280); font-style: italic; margin-top: 4px; line-height: 1.4; }
    .slot-value { display: flex; align-items: center; gap: 4px; margin-top: 6px; background: var(--ech-bg); padding: 4px 8px; border-radius: 2px; }
    .slot-value code { flex: 1; font-size: 10px; color: var(--ech-warning); background: transparent; padding: 0; font-family: var(--ech-font-mono); word-break: break-all; }
    .slot-actions { display: flex; gap: 4px; margin-top: 6px; }
    .ds-picker { flex: 1; font-size: 11px; }
    .slot-empty { padding: 4px 0; }
  `],
})
export class DesignerShellComponent {
  readonly pages: ReadonlyArray<PageEntry> = this.collectPages();
  readonly selectedId = signal<string>(this.pages[0]?.id ?? '');
  /**
   * selectedPage — base entry (z registry lub z draftPages). CELOWO NIE czyta
   * draftModel/draftVersion żeby uniknąć circular dependency z effectem który
   * rebuilds draftModel na zmianę selectedId (effect pisze → computed by re-ran
   * → read draftModel znów ... infinite loop → browser hang).
   *
   * Edit-mode dynamic title/widgetCount dostajemy przez osobne computed
   * (selectedPageLive — używane tylko tam gdzie naprawdę potrzeba draftu).
   */
  readonly selectedPage = computed<PageEntry | null>(() => {
    const id = this.selectedId();
    return this.pages.find((p) => p.id === id) ?? this.draftPages().find((p) => p.id === id) ?? null;
  });

  /** Dodatkowa warstwa — pokazuje draft title/widgetCount gdy edit mode ON. Nie używana w effect. */
  readonly selectedPageLive = computed<PageEntry | null>(() => {
    const base = this.selectedPage();
    if (!base) return null;
    this.draftVersion();
    const model = this.draftModel();
    if (!model) return base;
    const draft = model.snapshot();
    return { ...base, title: draft.title, widgetCount: draft.widgets.length };
  });
  readonly previewLoading = signal<boolean>(false);
  readonly selectedWidgetType = signal<string | null>(null);
  readonly filter = signal<string>('');
  readonly inspectedInstanceId = signal<string | null>(null);

  // DnD state
  readonly draggingWidgetIdx = signal<number | null>(null);
  readonly dragOverWidgetIdx = signal<number | null>(null);
  readonly draggingPaletteType = signal<string | null>(null);
  readonly viewMode = signal<'layout' | 'preview' | 'source-ts' | 'source-json'>('layout');
  /**
   * Edit mode — przełącznik globalny. Default OFF (read-only zgodnie z Fazą 1).
   * ON → PageDesignerModel przejmuje kontrolę, wszystkie zmiany lecą przez
   * .apply() i można je undo/redo. Source view re-renderuje się live.
   */
  readonly editMode = signal<boolean>(false);
  /**
   * Draft model — tworzony gdy user wybierze stronę. Trzyma aktualny stan
   * edycji (undo stack, redo stack, current DraftPage).
   */
  private readonly draftModel = signal<PageDesignerModel | null>(null);

  /**
   * Container scope stack — ścieżka do aktualnego containera w hierarchii.
   * Pusty array = top-level page. [container1_id] = edytujemy childConfig
   * container1. [container1_id, container2_id] = edytujemy container2 INSIDE
   * container1.
   *
   * Designer UI pokazuje breadcrumb + "enter" action na container card.
   *
   * Mechanizm: TOP-LEVEL draftModel zawsze wskazuje na page config. Gdy user
   * wchodzi w container, scope stack rośnie — wszystkie UI operacje
   * (palette add, layout edit, inspector) odczytują i mutują child config
   * container-a przez ścieżkę scope stacka.
   */
  readonly scopeStack = signal<ReadonlyArray<{ containerId: string; title: string }>>([]);

  /**
   * Dodaj pusty childConfig do container widgetu gdy user kliknie "Init container".
   * childConfig to zagnieżdżona PageConfig — renderuje się rekursywnie przez
   * framework-owy PageRendererComponent.
   */
  initContainer(instanceId: string): void {
    const m = this.draftModel();
    if (!m) return;
    const w = m.snapshot().widgets.find((wd) => wd.id === instanceId);
    if (!w || w.type !== 'container') return;
    const existing = (w.widget.options ?? {}) as Record<string, unknown>;
    if (existing['childConfig']) return; // już zainicjowany
    const emptyChildConfig: PageConfig = {
      $schemaVersion: '2026.04-alpha' as PageConfig['$schemaVersion'],
      page: {
        id: `${instanceId}-inner`,
        title: existing['title'] as string ?? instanceId,
        layout: { type: 'grid', items: [] },
        widgets: {},
      },
    };
    this.applyDraft((dm) => dm.updateWidget(instanceId, {
      options: { ...existing, childConfig: emptyChildConfig },
    }));
  }

  /**
   * Enter container — rozwija scope stack. W M29 tylko UI hint w breadcrumb;
   * pełna scope-aware edycja canvas/palette/inspector przyjdzie w M30.
   */
  enterContainer(instanceId: string): void {
    const m = this.draftModel();
    if (!m) return;
    const w = m.snapshot().widgets.find((wd) => wd.id === instanceId);
    if (!w || w.type !== 'container') return;
    const existing = (w.widget.options ?? {}) as Record<string, unknown>;
    if (!existing['childConfig']) {
      // Init first — potem user może wejść
      this.initContainer(instanceId);
      return;
    }
    const title = (existing['title'] as string) ?? instanceId;
    this.scopeStack.update((stack) => [...stack, { containerId: instanceId, title }]);
    if (typeof window !== 'undefined') {
      window.alert(`⚡ Scope navigation (M30) — widzisz container "${title}" jako scope w breadcrumb.\n\nPełna edycja children wymaga dalszego refactora canvas. W M29 edytuj options.childConfig ręcznie w sekcji Bind/Options JAKO JSON (inline JSON edit trafi w M30).`);
    }
  }

  /** Wyjdź z container scope — cofnij breadcrumb o jeden level. */
  exitContainer(): void {
    this.scopeStack.update((stack) => stack.slice(0, -1));
  }

  /** Wyjdź do top-level page. */
  exitToTop(): void {
    this.scopeStack.set([]);
  }
  readonly canUndo = signal<boolean>(false);
  readonly canRedo = signal<boolean>(false);
  /** Licznik zmian — zwiększany po każdym apply żeby wymusić re-render computed. */
  private readonly draftVersion = signal<number>(0);
  /** Save dialog state. */
  readonly saveDialogOpen = signal<boolean>(false);
  readonly saveCopied = signal<boolean>(false);

  /** Datasource creator dialog state. */
  readonly dsDialogOpen = signal<boolean>(false);
  readonly dsEditingId = signal<string | null>(null); // null = create, string = edit
  readonly dsFormId = signal<string>('');
  readonly dsFormKind = signal<'transport' | 'local' | 'computed' | 'static' | 'value'>('value');
  readonly dsFormValueType = signal<'string' | 'number' | 'boolean' | 'json'>('string');
  readonly dsFormValueInput = signal<string>('');
  readonly dsFormTransport = signal<string>('http');
  readonly dsFormEndpoint = signal<string>('');
  readonly dsFormChannel = signal<string>('');
  readonly dsFormStaticUrl = signal<string>('');
  readonly dsFormInitial = signal<string>('');
  readonly dsFormFn = signal<string>('');
  readonly dsFormInputs = signal<string>('');
  readonly dsFormError = signal<string>('');

  /** New page dialog state. */
  readonly newPageDialogOpen = signal<boolean>(false);
  readonly newPageId = signal<string>('');
  readonly newPageTitle = signal<string>('');
  readonly newPageRoute = signal<string>('');
  readonly newPageTemplate = signal<'empty' | 'list' | 'dashboard' | 'form'>('empty');
  readonly newPageError = signal<string>('');

  private readonly draftStore = inject(DraftPageStoreService);

  /**
   * Draft pages — teraz czyta z persystentnego storu (localStorage via
   * DraftPageStoreService). Nie jest już lokalny signal, tylko derived
   * z store. Każdy page dostaje route '/draft/{id}' żeby można było do
   * niego nawigować bez rebuildu appki.
   */
  readonly draftPages = computed<ReadonlyArray<PageEntry>>(() => {
    return this.draftStore.all().map((d) => ({
      id: d.id,
      title: d.title,
      route: `/draft/${d.id}`,
      config: d.config,
      widgetCount: Object.keys(d.config.page.widgets).length,
      dsCount: Object.keys(d.config.page.datasources ?? {}).length,
      computedCount: Object.keys(d.config.page.computed ?? {}).length,
      handlerCount: (d.config.page.eventHandlers ?? []).length,
      sourceClassName: d.className,
    }));
  });

  /** Który handler jest rozwinięty w inspectorze (ID z draftu). */
  readonly expandedHandlerId = signal<string | null>(null);

  /** Który field formularza jest rozwinięty (form-builder). */
  readonly expandedFormFieldId = signal<string | null>(null);

  /** Lista pól formularza dla aktualnie wybranego validated-form widgetu. */
  readonly formFields = computed<ReadonlyArray<{
    id: string;
    label: string;
    type: string;
    placeholder?: string;
    hint?: string;
    section?: string;
    required?: boolean;
    readonly?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  }>>(() => {
    const iw = this.inspectedWidget();
    if (!iw || iw.type !== 'validated-form') return [];
    const options = iw.options as Record<string, unknown> | undefined;
    const fieldsRaw = options?.['fields'];
    if (!Array.isArray(fieldsRaw)) return [];
    return fieldsRaw.map((f) => {
      const field = f as Record<string, unknown>;
      return {
        id: String(field['id'] ?? ''),
        label: String(field['label'] ?? field['id'] ?? ''),
        type: String(field['type'] ?? 'text'),
        placeholder: field['placeholder'] as string | undefined,
        hint: field['hint'] as string | undefined,
        section: field['section'] as string | undefined,
        required: field['required'] === true,
        readonly: field['readonly'] === true,
        min: field['min'] as number | undefined,
        max: field['max'] as number | undefined,
        minLength: field['minLength'] as number | undefined,
        maxLength: field['maxLength'] as number | undefined,
        pattern: field['pattern'] as string | undefined,
      };
    });
  });
  /** Flaga: czy draft różni się od oryginalnego configu (proste sprawdzenie po serialize). */
  readonly hasChanges = computed<boolean>(() => {
    const p = this.selectedPage();
    const m = this.draftModel();
    if (!p || !m) return false;
    this.draftVersion();
    const originalDraft = PageDesignerModel.fromPageConfig(p.config).snapshot();
    const currentDraft = m.snapshot();
    return serialize(originalDraft, { target: 'json' }) !== serialize(currentDraft, { target: 'json' });
  });

  readonly generatedSource = computed<string>(() => {
    const p = this.selectedPage();
    if (!p) return '';
    const mode = this.viewMode();
    if (mode === 'preview') return '';
    // Reactywne na draftVersion — każdy apply bumpnie counter, computed się odpala.
    this.draftVersion();
    const model = this.draftModel();
    const draft = model ? model.snapshot() : PageDesignerModel.fromPageConfig(p.config).snapshot();
    return serialize(draft, { target: mode === 'source-ts' ? 'page-builder' : 'json' });
  });

  readonly sourceLineCount = computed<number>(() => {
    const src = this.generatedSource();
    return src ? src.split('\n').length : 0;
  });

  readonly highlightedSource = computed<string>(() => {
    const mode = this.viewMode();
    const safeMode: 'preview' | 'source-ts' | 'source-json' =
      mode === 'source-ts' || mode === 'source-json' || mode === 'preview' ? mode : 'source-ts';
    return highlightSource(this.generatedSource(), safeMode);
  });

  readonly fullFileSource = computed<string>(() => {
    const p = this.selectedPage();
    if (!p) return '';
    this.draftVersion();
    const model = this.draftModel();
    const draft = model ? model.snapshot() : PageDesignerModel.fromPageConfig(p.config).snapshot();
    return serialize(draft, { target: 'page-builder' });
  });

  readonly highlightedSaveSource = computed<string>(() => {
    return highlightSource(this.fullFileSource(), 'source-ts');
  });

  /** Lista dostępnych bind targets dla bieżącej strony — datasources + computed + local. */
  /**
   * Manifest slots — lista wymaganych / dostępnych pól widget-a z manifestu,
   * zmapowana ze stanem wypełnienia w bieżącej instancji.
   * Pozwala user-owi zobaczyć co jeszcze musi podpiąć (required) oraz
   * szybki "fill the blank" flow zamiast pamiętać nazwy bindingów.
   */
  readonly manifestSlots = computed<ReadonlyArray<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    filled: boolean;
    filledAs: 'bind' | 'option' | null;
    currentValue: string;
  }>>(() => {
    const iw = this.inspectedWidget();
    if (!iw || !iw.manifest) return [];
    this.draftVersion();
    const bind = iw.bind ?? {};
    const options = iw.options ?? {};
    const all: Array<{ name: string; type: string; required: boolean; description?: string }> = [
      ...iw.manifest.inputs.map((i) => ({ name: i.name, type: i.type, required: i.required ?? false, description: (i as { description?: string }).description })),
    ];
    return all.map((i) => {
      const inBind = Object.prototype.hasOwnProperty.call(bind, i.name);
      const inOptions = Object.prototype.hasOwnProperty.call(options, i.name);
      const filled = inBind || inOptions;
      const rawValue: unknown = inBind ? bind[i.name] : (inOptions ? options[i.name] : undefined);
      return {
        name: i.name,
        type: i.type,
        required: i.required,
        ...(i.description ? { description: i.description } : {}),
        filled,
        filledAs: inBind ? 'bind' as const : (inOptions ? 'option' as const : null),
        currentValue: filled ? this.formatVal(rawValue) : '',
      };
    });
  });

  readonly bindTargets = computed<ReadonlyArray<{ name: string; kind: 'ds' | 'computed' | 'local' }>>(() => {
    const p = this.selectedPage();
    if (!p) return [];
    this.draftVersion();
    const targets: Array<{ name: string; kind: 'ds' | 'computed' | 'local' }> = [];
    const page = p.config.page;
    for (const name of Object.keys(page.datasources ?? {})) {
      const kind = (page.datasources?.[name]?.kind) ?? 'transport';
      targets.push({ name, kind: kind === 'local' ? 'local' : 'ds' });
    }
    for (const name of Object.keys(page.computed ?? {})) {
      targets.push({ name, kind: 'computed' });
    }
    targets.sort((a, b) => a.name.localeCompare(b.name));
    return targets;
  });

  readonly pageDatasources = computed<ReadonlyArray<{ id: string; kind: string; transport?: string; endpoint?: string }>>(() => {
    const p = this.selectedPage();
    if (!p) return [];
    this.draftVersion();
    const model = this.draftModel();
    // Edit mode: czytaj z draftu (lista z rc.16)
    if (model) {
      return model.snapshot().datasources.map((d) => {
        const cfg = d.config;
        const out: { id: string; kind: string; transport?: string; endpoint?: string } = {
          id: d.id,
          kind: cfg.kind ?? 'transport',
        };
        if (cfg.transport) out.transport = cfg.transport;
        if (cfg.endpoint) out.endpoint = cfg.endpoint;
        return out;
      });
    }
    const dss = p.config.page.datasources ?? {};
    return Object.entries(dss).map(([id, d]) => {
      const out: { id: string; kind: string; transport?: string; endpoint?: string } = {
        id,
        kind: d.kind ?? 'transport',
      };
      if (d.transport) out.transport = d.transport;
      if (d.endpoint) out.endpoint = d.endpoint;
      return out;
    });
  });

  readonly pageComputed = computed<ReadonlyArray<{ id: string; fn?: string; deps: ReadonlyArray<string> }>>(() => {
    const p = this.selectedPage();
    if (!p) return [];
    this.draftVersion();
    const model = this.draftModel();
    if (model) {
      return model.snapshot().computed.map((c) => {
        const def = c.config as { fn?: string; expr?: string; deps?: ReadonlyArray<string>; inputs?: ReadonlyArray<string> };
        const out: { id: string; fn?: string; deps: ReadonlyArray<string> } = {
          id: c.id,
          deps: def.deps ?? def.inputs ?? [],
        };
        if (def.fn) out.fn = def.fn;
        else if (def.expr) out.fn = def.expr;
        return out;
      });
    }
    const cs = p.config.page.computed ?? {};
    return Object.entries(cs).map(([id, c]) => {
      const def = c as { fn?: string; expr?: string; deps?: ReadonlyArray<string>; inputs?: ReadonlyArray<string> };
      const out: { id: string; fn?: string; deps: ReadonlyArray<string> } = {
        id,
        deps: def.deps ?? def.inputs ?? [],
      };
      if (def.fn) out.fn = def.fn;
      else if (def.expr) out.fn = def.expr;
      return out;
    });
  });

  readonly pageHandlers = computed<ReadonlyArray<{
    idx: number;
    handlerId: string;
    on: string;
    actions: ReadonlyArray<{ idx: number; type: string; value: string }>;
  }>>(() => {
    const p = this.selectedPage();
    if (!p) return [];
    this.draftVersion();
    const model = this.draftModel();

    const describeAction = (a: unknown, idx: number): { idx: number; type: string; value: string } => {
      const obj = a as Record<string, unknown>;
      if ('emit' in obj) return { idx, type: 'emit', value: String(obj['emit']) };
      if ('setDatasource' in obj) return { idx, type: 'setDatasource', value: String(obj['setDatasource']) + (obj['from'] ? ' ← ' + obj['from'] : '') };
      if ('clearDatasource' in obj) return { idx, type: 'clearDatasource', value: String(obj['clearDatasource']) };
      if ('call' in obj) return { idx, type: 'call', value: String(obj['call']) };
      if ('callComputed' in obj) return { idx, type: 'callComputed', value: String(obj['callComputed']) + (obj['into'] ? ' → ' + obj['into'] : '') };
      if ('fetch' in obj) return { idx, type: 'fetch', value: String(obj['fetch']) };
      return { idx, type: '?', value: JSON.stringify(obj) };
    };

    if (model) {
      return model.snapshot().handlers.map((h, idx) => ({
        idx,
        handlerId: h.id,
        on: h.config.on,
        actions: h.config.do.map(describeAction),
      }));
    }
    const handlers = p.config.page.eventHandlers ?? [];
    return handlers.map((h, idx) => ({
      idx,
      handlerId: `read-${idx}`,
      on: h.on,
      actions: h.do.map(describeAction),
    }));
  });

  readonly COLS: ReadonlyArray<number> = Array.from({ length: 12 }, (_, i) => i);

  /**
   * Layout cells — reprezentacja widgetów jako prymitywy z grid pozycjami.
   * Używane przez Layout view (canvas bez renderu iframe).
   */
  readonly layoutCells = computed<ReadonlyArray<{
    instanceId: string;
    type: string;
    icon?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    bindings: ReadonlyArray<{ key: string; value: string }>;
    hasRequiredUnfilled: boolean;
  }>>(() => {
    const p = this.selectedPage();
    if (!p) return [];
    this.draftVersion();
    const model = this.draftModel();

    const checkRequired = (type: string, bind: Record<string, string> | undefined, options: Record<string, unknown> | undefined): boolean => {
      const m = this.registry?.get(type)?.manifest;
      if (!m) return false;
      for (const input of m.inputs) {
        if (!input.required) continue;
        const hasBind = bind && Object.prototype.hasOwnProperty.call(bind, input.name);
        const hasOpt = options && Object.prototype.hasOwnProperty.call(options, input.name);
        if (!hasBind && !hasOpt) return true;
      }
      return false;
    };

    if (model) {
      return model.snapshot().widgets.map((w) => ({
        instanceId: w.id,
        type: w.type,
        icon: this.registry?.get(w.type)?.manifest.icon,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        bindings: Object.entries(w.widget.bind ?? {}).map(([key, value]) => ({ key, value: String(value) })),
        hasRequiredUnfilled: checkRequired(w.type, w.widget.bind, w.widget.options),
      }));
    }
    const widgets = p.config.page.widgets ?? {};
    const layoutItems = p.config.page.layout.items;
    return Object.entries(widgets).map(([id, w]) => {
      const item = (layoutItems.find((it) => it.widget === id) ?? {}) as { x?: number; y?: number; w?: number; h?: number };
      return {
        instanceId: id,
        type: w.type,
        icon: this.registry?.get(w.type)?.manifest.icon,
        x: item.x, y: item.y, w: item.w, h: item.h,
        bindings: Object.entries(w.bind ?? {}).map(([key, value]) => ({ key, value: String(value) })),
        hasRequiredUnfilled: checkRequired(w.type, w.bind, w.options),
      };
    });
  });

  /** Ile row-ów używa strona — do ruler + grid-template-rows. */
  readonly rowIndices = computed<ReadonlyArray<number>>(() => {
    const cells = this.layoutCells();
    let maxY = 0;
    for (const c of cells) {
      const bottom = (c.y ?? 0) + (c.h ?? 1);
      if (bottom > maxY) maxY = bottom;
    }
    // Minimum 6 rowów zawsze widocznych — żeby user miał miejsce do upuszczenia nowych widget
    const count = Math.max(6, maxY + 2);
    return Array.from({ length: count }, (_, i) => i);
  });

  /** Grid template rows — każdy row ~80px (realistic page row height). */
  readonly gridTemplateRows = computed<string>(() => {
    const n = this.rowIndices().length;
    return `repeat(${n}, 80px)`;
  });

  readonly pageWidgets = computed<ReadonlyArray<{ instanceId: string; type: string }>>(() => {
    const p = this.selectedPage();
    if (!p) return [];
    this.draftVersion();
    const model = this.draftModel();
    if (model) {
      return model.snapshot().widgets.map((w) => ({ instanceId: w.id, type: w.type }));
    }
    const widgets = p.config.page.widgets ?? {};
    return Object.entries(widgets).map(([instanceId, w]) => ({ instanceId, type: w.type }));
  });

  readonly inspectedWidget = computed<InspectedWidget | null>(() => {
    const p = this.selectedPage();
    const id = this.inspectedInstanceId();
    if (!p || !id) return null;
    this.draftVersion();
    const model = this.draftModel();

    if (model) {
      // Edit mode — draft jako źródło
      const draftW = model.snapshot().widgets.find((w) => w.id === id);
      if (!draftW) return null;
      return {
        instanceId: id,
        type: draftW.type,
        pageRoute: p.route,
        bind: draftW.widget.bind,
        options: draftW.widget.options,
        when: draftW.widget.when,
        layout: { x: draftW.layout.x, y: draftW.layout.y, w: draftW.layout.w, h: draftW.layout.h },
        manifest: this.registry?.get(draftW.type)?.manifest,
      };
    }
    // Read-only mode
    const widgetCfg = (p.config.page.widgets ?? {})[id];
    if (!widgetCfg) return null;
    const layoutItem = p.config.page.layout.items.find((it) => it.widget === id) as { x?: number; y?: number; w?: number; h?: number } | undefined ?? {};
    return {
      instanceId: id,
      type: widgetCfg.type,
      pageRoute: p.route,
      bind: widgetCfg.bind,
      options: widgetCfg.options,
      when: widgetCfg.when,
      layout: { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h },
      manifest: this.registry?.get(widgetCfg.type)?.manifest,
    };
  });
  private readonly registry = inject(WIDGET_REGISTRY, { optional: true }) as WidgetRegistry | null;
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
  /** True gdy wybrana strona jest tylko draftem w pamięci (nie w Angular routerze). */
  readonly isDraftPage = computed<boolean>(() => {
    const id = this.selectedId();
    return this.draftPages().some((p) => p.id === id);
  });

  readonly previewUrl = computed<SafeUrl | null>(() => {
    const p = this.selectedPage();
    if (!p) return null;
    // Drafty mają dynamic route /draft/:id — iframe renderuje je przez
    // DraftPageRendererComponent (czyta z localStorage).
    // Menu/chrome jest chowany przez AppComponent.embedMode który wykrywa
    // iframe przez window.self !== window.top — niezależnie od URL.
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

    // Gdy zmienia się wybrana strona LUB włączamy edit mode — rebuild draftModel.
    // CELOWO NIE używamy selectedPage() (computed) tylko źródłowe signals, żeby
    // tracking dependency nie łapał draftVersion/draftModel które sami tu zapisujemy.
    // Rebuild modelu TYLKO gdy selectedId lub editMode się zmienia.
    // CELOWO nie czytamy draftStore.all() (signal) — byłby to infinite loop,
    // bo persist po mutacji aktualizowałby drafts signal → effect re-runs →
    // rebuild modelu → gubimy undo stack + kontekst user-a.
    // Config bierzemy przez synchroniczne store.get() które jest poza tracking.
    effect(() => {
      const id = this.selectedId();
      const enabled = this.editMode();
      const registered = this.pages.find((p) => p.id === id);
      const draft = registered ? null : this.draftStore.get(id);
      const base = registered ?? draft;

      if (!base || !enabled) {
        queueMicrotask(() => {
          this.draftModel.set(null);
          this.canUndo.set(false);
          this.canRedo.set(false);
        });
        return;
      }
      const config = base.config;
      const model = PageDesignerModel.fromPageConfig(config);
      queueMicrotask(() => {
        this.draftModel.set(model);
        this.refreshUndoRedo();
        this.draftVersion.update((v) => v + 1);
      });
    });
  }

  /**
   * Persist aktualnego draftu do store — wywoływane bezpośrednio z applyDraft,
   * NIE przez effect, żeby nie wywoływać loop-a reactivity.
   * Idempotentne: jeśli selectedId nie jest draftem (tylko registered page),
   * no-op.
   */
  private persistDraftIfNeeded(): void {
    const id = this.selectedId();
    if (!id) return;
    const model = this.draftModel();
    if (!model) return;
    const draftInStore = this.draftStore.get(id);
    if (!draftInStore) return;
    const snapshot = model.snapshot();
    const nextConfig = buildConfigFromDraft(snapshot, draftInStore.config.$schemaVersion);
    this.draftStore.update(id, nextConfig, snapshot.title);
  }

  private refreshUndoRedo(): void {
    const m = this.draftModel();
    this.canUndo.set(m ? m.canUndo() : false);
    this.canRedo.set(m ? m.canRedo() : false);
  }

  /**
   * Aplikuje mutację na draftModel. Musi być używane do KAŻDEJ zmiany — gwarantuje
   * undo stack entry + reactivity (draftVersion bump).
   */
  private applyDraft(mutate: (m: PageDesignerModel) => void): void {
    const m = this.draftModel();
    if (!m) return;
    mutate(m);
    this.refreshUndoRedo();
    this.draftVersion.update((v) => v + 1);
    // Direct call do persist — nie przez effect, żeby uniknąć pętli
    // reactivity (effect czytający drafts signal by rebuildował model po
    // każdym save, co by resetowało undo stack).
    this.persistDraftIfNeeded();
  }

  undo(): void {
    const m = this.draftModel();
    if (!m) return;
    m.undo();
    this.refreshUndoRedo();
    this.draftVersion.update((v) => v + 1);
    this.persistDraftIfNeeded();
  }

  redo(): void {
    const m = this.draftModel();
    if (!m) return;
    m.redo();
    this.refreshUndoRedo();
    this.draftVersion.update((v) => v + 1);
    this.persistDraftIfNeeded();
  }

  toggleEditMode(): void {
    this.editMode.update((v) => !v);
  }

  /** Edytuj tytuł strony — trafia przez model.setTitle → undo stack. */
  editTitle(nextTitle: string): void {
    this.applyDraft((m) => m.setTitle(nextTitle));
  }

  /** Edytuj options pojedyncze pole widgetu — trafia przez model.updateWidget. */
  editWidgetOption(instanceId: string, key: string, value: unknown): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId)?.widget;
    if (!current) return;
    const nextOptions = { ...(current.options ?? {}), [key]: value };
    this.applyDraft((dm) => dm.updateWidget(instanceId, { options: nextOptions }));
  }

  editWidgetBind(instanceId: string, key: string, value: string): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId)?.widget;
    if (!current) return;
    const nextBind = { ...(current.bind ?? {}), [key]: value };
    this.applyDraft((dm) => dm.updateWidget(instanceId, { bind: nextBind }));
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

  asString(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  /** Pola złożone (obiekty/tablice) nie są edytowalne inline — wymagają panelu dedykowanego (M8+). */
  isScalarOption(v: unknown): boolean {
    return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
  }

  onTitleChange(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.editTitle(v);
  }

  onBindChange(instanceId: string, key: string, event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.editWidgetBind(instanceId, key, v);
  }

  onOptionChange(instanceId: string, key: string, event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    // Zachowaj typ — jeśli numeryczne, parsuj
    const n = Number(v);
    const parsed = v !== '' && !Number.isNaN(n) ? n : v === 'true' ? true : v === 'false' ? false : v;
    this.editWidgetOption(instanceId, key, parsed);
  }

  /** Zmiana typu widgetu — zachowujemy instanceId, bind, options. Runtime decyduje co pasuje. */
  onWidgetTypeChange(instanceId: string, event: Event): void {
    const newType = (event.target as HTMLSelectElement).value;
    this.applyDraft((dm) => dm.updateWidget(instanceId, { type: newType }));
  }

  addBindKey(instanceId: string): void {
    const key = this.promptKey('bind');
    if (!key) return;
    this.editWidgetBind(instanceId, key, '');
  }

  addOptionKey(instanceId: string): void {
    const key = this.promptKey('option');
    if (!key) return;
    this.editWidgetOption(instanceId, key, '');
  }

  removeBindKey(instanceId: string, key: string): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId)?.widget;
    if (!current) return;
    const next: Record<string, string> = { ...(current.bind ?? {}) };
    delete next[key];
    this.applyDraft((dm) => dm.updateWidget(instanceId, { bind: next }));
  }

  removeOptionKey(instanceId: string, key: string): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId)?.widget;
    if (!current) return;
    const next: Record<string, unknown> = { ...(current.options ?? {}) };
    delete next[key];
    this.applyDraft((dm) => dm.updateWidget(instanceId, { options: next }));
  }

  private promptKey(label: string): string | null {
    if (typeof window === 'undefined') return null;
    const key = window.prompt(`Nazwa pola ${label}:`);
    if (!key || !/^[a-zA-Z_][\w.]*$/.test(key)) {
      if (key) window.alert('Nazwa musi być prawidłowym identyfikatorem (liter-cyfry-kropki).');
      return null;
    }
    return key;
  }

  /**
   * Klik w palette:
   *  - Edit OFF → tylko highlight (selectedWidgetType)
   *  - Edit ON  → dodaj nową instancję widgetu do strony
   */
  onPaletteClick(type: string): void {
    this.selectedWidgetType.set(type);
    if (!this.editMode()) return;
    const m = this.draftModel();
    if (!m) return;
    const instanceId = this.generateInstanceId(type);
    const nextY = this.findNextFreeY();
    const defaultW = this.defaultWidthFor(type);
    this.applyDraft((dm) =>
      dm.addWidget({
        id: instanceId,
        type,
        layout: { widget: instanceId, x: 0, y: nextY, w: defaultW },
        widget: { type },
      }),
    );
    this.inspectedInstanceId.set(instanceId);
  }

  /**
   * Smart default szerokości widgetu — na podstawie category/name heurystyki.
   * User nie musi ręcznie zwężać każdego widget z w=12. Trafia do naturalnej
   * wielkości: tytuły pełne, formularze/tabele full lub half w zależności.
   */
  private defaultWidthFor(type: string): number {
    const manifest = this.registry?.get(type)?.manifest;
    const cat = manifest?.category ?? '';
    // Presets per kategoria
    if (type.includes('page-title') || type === 'title') return 12;
    if (type.includes('actions-bar') || type.includes('toolbar')) return 12;
    if (cat === 'table' || type.includes('grid') || type.includes('table')) return 12;
    if (type.includes('chart')) return 8;
    if (type.includes('form')) return 8;
    if (cat === 'kpi' || type.includes('stat') || type.includes('tile')) return 4;
    if (type.includes('card')) return 6;
    return 6; // sensowny default — połówka
  }

  /** Generator unikalnych instance ID — baza od typu + inkrementacja. */
  private generateInstanceId(type: string): string {
    const m = this.draftModel();
    if (!m) return type;
    const existing = new Set(m.snapshot().widgets.map((w) => w.id));
    const base = type.replace(/[^a-zA-Z0-9]/g, '');
    let candidate = base;
    let n = 2;
    while (existing.has(candidate)) {
      candidate = `${base}${n}`;
      n += 1;
    }
    return candidate;
  }

  /** Znajduje pierwszy wolny Y w gridzie 12-col — proste, bez rozwiązywania pełnego packera. */
  private findNextFreeY(): number {
    const m = this.draftModel();
    if (!m) return 0;
    let maxBottom = 0;
    for (const w of m.snapshot().widgets) {
      const top = w.layout.y ?? 0;
      const h = w.layout.h ?? 1;
      maxBottom = Math.max(maxBottom, top + h);
    }
    return maxBottom;
  }

  /** Usuwa bieżąco zaznaczony widget ze strony. */
  onLayoutChange(instanceId: string, field: 'x' | 'y' | 'w' | 'h', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId);
    if (!current) return;
    const parsed = raw === '' ? undefined : Number(raw);
    if (parsed !== undefined && Number.isNaN(parsed)) return;
    const layoutPatch: Record<string, number | undefined> = { [field]: parsed };
    this.applyDraft((dm) => dm.moveWidget(instanceId, layoutPatch));
  }

  moveWidget(instanceId: string, dir: 'up' | 'down'): void {
    const m = this.draftModel();
    if (!m) return;
    const w = m.snapshot().widgets.find((wd) => wd.id === instanceId);
    if (!w) return;
    const currentY = w.layout.y ?? 0;
    const nextY = dir === 'up' ? Math.max(0, currentY - 1) : currentY + 1;
    this.applyDraft((dm) => dm.moveWidget(instanceId, { y: nextY }));
  }

  // ───────────────────────────── Drag & Drop ─────────────────────────────

  onWidgetDragStart(idx: number, event: DragEvent): void {
    if (!this.editMode()) { event.preventDefault(); return; }
    this.draggingWidgetIdx.set(idx);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-echelon-widget-idx', String(idx));
    }
  }

  onWidgetDragOver(idx: number, event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.draggingWidgetIdx() !== null && this.draggingWidgetIdx() !== idx) {
      this.dragOverWidgetIdx.set(idx);
    }
  }

  onWidgetDragLeave(idx: number): void {
    if (this.dragOverWidgetIdx() === idx) this.dragOverWidgetIdx.set(null);
  }

  onWidgetDrop(targetIdx: number, event: DragEvent): void {
    event.preventDefault();
    const sourceIdx = this.draggingWidgetIdx();
    this.dragOverWidgetIdx.set(null);
    this.draggingWidgetIdx.set(null);
    if (sourceIdx === null || sourceIdx === targetIdx) return;
    const m = this.draftModel();
    if (!m) return;
    const widgets = m.snapshot().widgets;
    const ids = widgets.map((w) => w.id);
    const [moved] = ids.splice(sourceIdx, 1);
    if (!moved) return;
    ids.splice(targetIdx, 0, moved);
    this.applyDraft((dm) => dm.reorderWidgets(ids));
  }

  onWidgetDragEnd(): void {
    this.draggingWidgetIdx.set(null);
    this.dragOverWidgetIdx.set(null);
  }

  onPaletteDragStart(type: string, event: DragEvent): void {
    if (!this.editMode()) { event.preventDefault(); return; }
    this.draggingPaletteType.set(type);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-echelon-palette-type', type);
    }
  }

  onPaletteDragEnd(): void {
    this.draggingPaletteType.set(null);
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const type = this.draggingPaletteType() ?? event.dataTransfer?.getData('application/x-echelon-palette-type');
    this.draggingPaletteType.set(null);
    if (!type) return;
    // Reuse istniejącej logiki dodawania z palette klik
    this.onPaletteClick(type);
  }

  // ───── Primitive card DnD (Layout view) ─────

  private readonly draggingPrimitiveId = signal<string | null>(null);

  onPrimitiveDragStart(id: string, event: DragEvent): void {
    if (!this.editMode()) { event.preventDefault(); return; }
    this.draggingPrimitiveId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-echelon-primitive-id', id);
    }
  }

  onPrimitiveDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onPrimitiveDrop(targetId: string, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = this.draggingPrimitiveId() ?? event.dataTransfer?.getData('application/x-echelon-primitive-id');
    this.draggingPrimitiveId.set(null);
    if (!sourceId || sourceId === targetId) return;
    const m = this.draftModel();
    if (!m) return;
    const widgets = m.snapshot().widgets;
    const ids = widgets.map((w) => w.id);
    const srcIdx = ids.indexOf(sourceId);
    const tgtIdx = ids.indexOf(targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const [moved] = ids.splice(srcIdx, 1);
    if (!moved) return;
    ids.splice(tgtIdx, 0, moved);
    this.applyDraft((dm) => dm.reorderWidgets(ids));
  }

  onPrimitiveDragEnd(): void {
    this.draggingPrimitiveId.set(null);
  }

  /**
   * Podepnij datasource/computed/local pod slot widget-a (bind.<slotName> =
   * '$ds.<dsName>' dla transport/local, '$computed.<name>' dla computed).
   */
  bindSlotFromDatasource(instanceId: string, slotName: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const dsName = select.value;
    if (!dsName) return;
    const target = this.bindTargets().find((t) => t.name === dsName);
    if (!target) return;
    const prefix = target.kind === 'computed' ? '$computed' : '$ds';
    const value = `${prefix}.${dsName}`;
    this.editWidgetBind(instanceId, slotName, value);
    // Reset dropdown-a
    select.value = '';
  }

  /** Ustawia stałą wartość w options (np. title: 'Dashboard'). */
  bindSlotAsValue(instanceId: string, slotName: string, type: string): void {
    if (typeof window === 'undefined') return;
    const label = `Wartość dla "${slotName}" (${type}):`;
    const raw = window.prompt(label, '');
    if (raw === null) return;
    let value: unknown = raw;
    if (type === 'number' || type === 'decimal') {
      const n = Number(raw);
      if (!Number.isNaN(n)) value = n;
    } else if (type === 'boolean') {
      value = raw === 'true' || raw === '1';
    }
    this.editWidgetOption(instanceId, slotName, value);
  }

  /** Usuwa binding / option dla slot-u (w zależności jak był wypełniony). */
  unbindSlot(instanceId: string, slotName: string, filledAs: 'bind' | 'option' | null): void {
    if (filledAs === 'bind') this.removeBindKey(instanceId, slotName);
    else if (filledAs === 'option') this.removeOptionKey(instanceId, slotName);
  }

  /** Usuwa widget po ID — używane przez primitive card action button. */
  removeWidgetById(instanceId: string): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć widget "${instanceId}"?`)) return;
    this.applyDraft((dm) => dm.removeWidget(instanceId));
    if (this.inspectedInstanceId() === instanceId) this.inspectedInstanceId.set(null);
  }

  resizeFull(instanceId: string): void {
    this.applyDraft((dm) => dm.moveWidget(instanceId, { w: 12, x: 0 }));
  }

  resizeHalf(instanceId: string): void {
    this.applyDraft((dm) => dm.moveWidget(instanceId, { w: 6 }));
  }

  /**
   * Ustaw szerokość widgeta jako frakcję 12-col grid.
   * Mapowanie: 1/4=3, 1/3=4, 1/2=6, 2/3=8, 3/4=9, 1/1=12.
   * Pozwala user-owi myśleć proporcjami zamiast kolumnami.
   */
  setWidgetFraction(instanceId: string, fraction: '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | '1/1'): void {
    const widths: Record<typeof fraction, number> = {
      '1/4': 3, '1/3': 4, '1/2': 6, '2/3': 8, '3/4': 9, '1/1': 12,
    };
    this.applyDraft((dm) => dm.moveWidget(instanceId, { w: widths[fraction] }));
  }

  /**
   * Split horizontal: dodaje duplikat widget-a obok, obie połówki w/2.
   * Ograniczenie: widget musi mieć parzystą szerokość (w=2 → 2×1, w=4 → 2×2,
   * w=6 → 2×3, w=8 → 2×4, w=12 → 2×6). Dla nieparzystych — zaokrągl w górę.
   */
  splitHorizontal(instanceId: string): void {
    const m = this.draftModel();
    if (!m) return;
    const target = m.snapshot().widgets.find((wd) => wd.id === instanceId);
    if (!target) return;
    const curW = target.layout.w ?? 12;
    const halfW = Math.max(1, Math.floor(curW / 2));
    const newX = (target.layout.x ?? 0) + halfW;
    const newId = this.generateInstanceId(target.type);
    // Zmniejsz oryginalny
    this.applyDraft((dm) => dm.moveWidget(instanceId, { w: halfW }));
    // Dodaj duplikat obok
    this.applyDraft((dm) =>
      dm.addWidget({
        id: newId,
        type: target.type,
        layout: {
          widget: newId,
          x: newX,
          y: target.layout.y ?? 0,
          w: halfW,
          ...(target.layout.h !== undefined ? { h: target.layout.h } : {}),
        },
        widget: { ...target.widget },
      }),
    );
    this.inspectedInstanceId.set(newId);
  }

  /**
   * Split vertical: dodaje duplikat pod (y+h), obie zachowują pełną szerokość,
   * oryginalnego wysokość zostaje, nowy dostaje tę samą.
   */
  splitVertical(instanceId: string): void {
    const m = this.draftModel();
    if (!m) return;
    const target = m.snapshot().widgets.find((wd) => wd.id === instanceId);
    if (!target) return;
    const curH = target.layout.h ?? 1;
    const curY = target.layout.y ?? 0;
    const newY = curY + curH;
    const newId = this.generateInstanceId(target.type);
    this.applyDraft((dm) =>
      dm.addWidget({
        id: newId,
        type: target.type,
        layout: {
          widget: newId,
          ...(target.layout.x !== undefined ? { x: target.layout.x } : {}),
          y: newY,
          ...(target.layout.w !== undefined ? { w: target.layout.w } : {}),
          ...(target.layout.h !== undefined ? { h: target.layout.h } : {}),
        },
        widget: { ...target.widget },
      }),
    );
    this.inspectedInstanceId.set(newId);
  }

  openSaveDialog(): void {
    this.saveDialogOpen.set(true);
    this.saveCopied.set(false);
  }

  openNewPageDialog(): void {
    this.newPageId.set('');
    this.newPageTitle.set('');
    this.newPageRoute.set('');
    this.newPageTemplate.set('empty');
    this.newPageError.set('');
    this.newPageDialogOpen.set(true);
  }

  closeNewPageDialog(): void {
    this.newPageDialogOpen.set(false);
  }

  deleteDraft(): void {
    const id = this.selectedId();
    if (!id || !this.isDraftPage()) return;
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć draft "${id}" z localStorage? Tej operacji nie można cofnąć.`)) return;
    this.draftStore.remove(id);
    // Po remove draftPages się aktualizuje → selectedPage staje się null
    // Przełączamy na pierwszą zarejestrowaną stronę.
    this.selectedId.set(this.pages[0]?.id ?? '');
    this.editMode.set(false);
  }

  /** Input handler z auto-fill route/title z id (do czasu gdy user sam coś wpisze). */
  onNewIdInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    this.newPageId.set(sanitized);
    // Auto-fill route jeśli user jeszcze nie zmienił
    if (!this.newPageRoute() || this.newPageRoute().startsWith('/') && this.newPageRoute().slice(1).replace(/-/g, '') === '') {
      this.newPageRoute.set(sanitized ? `/${sanitized}` : '');
    }
    // Auto-fill title jeśli pusty
    if (!this.newPageTitle()) {
      const title = sanitized.split('-').map((s) => s ? s[0]!.toUpperCase() + s.slice(1) : '').join(' ');
      this.newPageTitle.set(title);
    }
  }

  createNewPage(): void {
    const id = this.newPageId().trim();
    const title = this.newPageTitle().trim() || id;
    // Route zawsze /draft/<id> — niezależnie od tego co user wpisał.
    // Draft ma dynamiczny route przez DraftPageRendererComponent.
    const template = this.newPageTemplate();

    if (!id) { this.newPageError.set('Page ID jest wymagane'); return; }
    if (!/^[a-z][a-z0-9-]*$/.test(id)) { this.newPageError.set('Page ID musi zaczynać się od litery, tylko lowercase + myślniki'); return; }
    if (this.pages.find((p) => p.id === id) || this.draftPages().find((p) => p.id === id)) {
      this.newPageError.set(`Strona o ID "${id}" już istnieje`);
      return;
    }

    const config = buildTemplateConfig(id, title, template);
    const className = id.split('-').map((s) => s ? s[0]!.toUpperCase() + s.slice(1) : '').join('') + 'Page';

    // Zapisz do persystentnego storu — draftPages computed od razu reaktywne.
    // Route '/draft/{id}' jest dostępny w Angular routerze przez wildcard.
    this.draftStore.upsert({ id, title, route: `/draft/${id}`, config, className });

    this.selectedId.set(id);
    this.editMode.set(true);
    // Draft ma teraz real route — można pokazać preview iframe (ale source
    // jest też użyteczne na start żeby zobaczyć co wygenerowaliśmy).
    this.viewMode.set('source-ts');
    this.closeNewPageDialog();
  }

  closeSaveDialog(): void {
    this.saveDialogOpen.set(false);
  }

  copySaveSource(): void {
    this.writeToClipboard(this.fullFileSource());
  }

  /** Kopiuje sam content `static readonly config = ...` — do wklejenia w istniejącej klasie. */
  copyConfigOnly(): void {
    const full = this.fullFileSource();
    // Wyciągnij tylko blok "PageBuilder.create(...)....build();" z pełnego pliku
    const match = full.match(/static readonly config = ([\s\S]+?\.build\(\));/);
    const configExpr = match ? match[1] : full;
    this.writeToClipboard(configExpr ?? '');
  }

  private writeToClipboard(text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard && text) {
      void navigator.clipboard.writeText(text).then(() => {
        this.saveCopied.set(true);
        setTimeout(() => this.saveCopied.set(false), 2000);
      });
    }
  }

  addDatasource(): void {
    this.dsEditingId.set(null);
    this.dsFormId.set('');
    this.dsFormKind.set('value'); // default: prosta wartość — najczęstszy case
    this.dsFormValueType.set('string');
    this.dsFormValueInput.set('');
    this.dsFormTransport.set('http');
    this.dsFormEndpoint.set('');
    this.dsFormChannel.set('');
    this.dsFormStaticUrl.set('');
    this.dsFormInitial.set('');
    this.dsFormFn.set('');
    this.dsFormInputs.set('');
    this.dsFormError.set('');
    this.dsDialogOpen.set(true);
  }

  /** Otwiera dialog w trybie edycji istniejącego datasource. */
  editDatasource(id: string): void {
    const m = this.draftModel();
    if (!m) return;
    const ds = m.snapshot().datasources.find((d) => d.id === id);
    if (!ds) return;
    const cfg = ds.config;
    this.dsEditingId.set(id);
    this.dsFormId.set(id);
    const kind = cfg.kind ?? 'transport';
    // Inferencja formy:
    //   'local' z initial value prostej (string/number/boolean) → kind 'value'
    //   'local' z initial object/array → kind 'local' (JSON edit)
    //   'local' bez initial → kind 'local'
    //   'transport' z url field → 'static'
    //   resztę jak kind w configu
    if ((cfg as { url?: string }).url) {
      this.dsFormKind.set('static');
    } else if (kind === 'local' && cfg.initial !== undefined && isPrimitive(cfg.initial)) {
      this.dsFormKind.set('value');
      if (typeof cfg.initial === 'string') {
        this.dsFormValueType.set('string');
        this.dsFormValueInput.set(cfg.initial);
      } else if (typeof cfg.initial === 'number') {
        this.dsFormValueType.set('number');
        this.dsFormValueInput.set(String(cfg.initial));
      } else if (typeof cfg.initial === 'boolean') {
        this.dsFormValueType.set('boolean');
        this.dsFormValueInput.set(cfg.initial ? 'true' : 'false');
      }
    } else {
      this.dsFormKind.set(kind === 'local' || kind === 'computed' ? kind : 'transport');
    }
    this.dsFormTransport.set(cfg.transport ?? 'http');
    this.dsFormEndpoint.set(cfg.endpoint ?? '');
    this.dsFormChannel.set(cfg.channel ?? '');
    this.dsFormStaticUrl.set((cfg as { url?: string }).url ?? '');
    this.dsFormInitial.set(cfg.initial !== undefined && !isPrimitive(cfg.initial) ? JSON.stringify(cfg.initial) : '');
    this.dsFormFn.set(cfg.fn ?? '');
    this.dsFormInputs.set((cfg.inputs ?? []).join(', '));
    this.dsFormError.set('');
    this.dsDialogOpen.set(true);
  }

  closeDsDialog(): void {
    this.dsDialogOpen.set(false);
  }

  /** Submit z dialog — create albo update w zależności od dsEditingId. */
  submitDsForm(): void {
    const id = this.dsFormId().trim();
    const editingId = this.dsEditingId();
    if (!id) { this.dsFormError.set('ID jest wymagane'); return; }
    if (!/^[a-zA-Z][\w]*$/.test(id)) { this.dsFormError.set('ID musi zaczynać się od litery (litery/cyfry/_)'); return; }
    const m = this.draftModel();
    if (!m) { this.dsFormError.set('Brak aktywnego draftu'); return; }
    if (id !== editingId && m.snapshot().datasources.some((d) => d.id === id)) {
      this.dsFormError.set(`Datasource "${id}" już istnieje`);
      return;
    }

    const kind = this.dsFormKind();
    const config = this.buildDsConfigFromForm();
    if (!config) { this.dsFormError.set('Uzupełnij wymagane pola dla wybranego typu'); return; }

    if (editingId) {
      // Edit flow
      if (id !== editingId) {
        this.applyDraft((dm) => dm.renameDatasource(editingId, id));
      }
      this.applyDraft((dm) => dm.updateDatasource(id, config));
    } else {
      // Create flow
      this.applyDraft((dm) => dm.addDatasource({ id, config }));
    }

    this.closeDsDialog();
    void kind;
  }

  private buildDsConfigFromForm(): DatasourceConfigShape | null {
    const kind = this.dsFormKind();
    if (kind === 'value') {
      const raw = this.dsFormValueInput();
      const type = this.dsFormValueType();
      let initial: unknown;
      if (type === 'number') {
        const n = Number(raw);
        if (Number.isNaN(n)) return null;
        initial = n;
      } else if (type === 'boolean') {
        initial = raw === 'true' || raw === '1' || raw === 'yes';
      } else if (type === 'json') {
        try { initial = JSON.parse(raw); } catch { return null; }
      } else {
        // string — nawet pusty akceptujemy (empty-string ds)
        initial = raw;
      }
      return { kind: 'local', initial };
    }
    if (kind === 'local') {
      const raw = this.dsFormInitial().trim();
      let initial: unknown = undefined;
      if (raw) {
        try { initial = JSON.parse(raw); } catch { initial = raw; }
      }
      return { kind: 'local', ...(initial !== undefined ? { initial } : {}) };
    }
    if (kind === 'computed') {
      const fn = this.dsFormFn().trim();
      if (!fn) return null;
      const inputs = this.dsFormInputs().split(',').map((s) => s.trim()).filter(Boolean);
      return { kind: 'computed', fn, inputs };
    }
    if (kind === 'static') {
      const url = this.dsFormStaticUrl().trim();
      if (!url) return null;
      return { kind: 'transport', transport: 'static', ...(url ? { endpoint: url } : {}) } as never;
    }
    // transport default (http/ws/mock)
    const transport = this.dsFormTransport() || 'http';
    const endpoint = this.dsFormEndpoint().trim();
    const channel = this.dsFormChannel().trim();
    if (transport === 'ws' && !channel && !endpoint) return null;
    if (transport === 'http' && !endpoint) return null;
    return {
      kind: 'transport',
      transport,
      ...(endpoint ? { endpoint } : {}),
      ...(channel ? { channel } : {}),
    };
  }

  removeDatasource(id: string): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć datasource "${id}"?`)) return;
    this.applyDraft((dm) => dm.removeDatasource(id));
  }

  addComputed(): void {
    const id = this.promptKey('computed (np. totalPnl)');
    if (!id) return;
    const fn = (typeof window !== 'undefined') ? window.prompt('Nazwa funkcji (zarejestrowana w functions/):', 'myFunction') : 'myFunction';
    if (!fn) return;
    const depsRaw = (typeof window !== 'undefined') ? window.prompt('Dependencies (comma-separated):', '') : '';
    const deps = (depsRaw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    this.applyDraft((dm) =>
      dm.addComputed({
        id,
        config: { expr: fn, deps } as never,
      }),
    );
  }

  removeComputed(id: string): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć computed "${id}"?`)) return;
    this.applyDraft((dm) => dm.removeComputed(id));
  }

  addHandler(): void {
    const on = (typeof window !== 'undefined') ? window.prompt('Event name (np. form.submit):', '') : '';
    if (!on) return;
    const handlerId = `h${Date.now()}-${on.replace(/[^a-zA-Z0-9]/g, '')}`;
    this.applyDraft((dm) =>
      dm.addHandler({
        id: handlerId,
        config: { on, do: [] as never[] },
      }),
    );
  }

  removeHandler(handlerId: string): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć handler "${handlerId}"?`)) return;
    this.applyDraft((dm) => dm.removeHandler(handlerId));
  }

  toggleHandler(handlerId: string): void {
    this.expandedHandlerId.update((cur) => cur === handlerId ? null : handlerId);
  }

  onHandlerEventChange(handlerId: string, event: Event): void {
    const newOn = (event.target as HTMLInputElement).value.trim();
    if (!newOn) return;
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().handlers.find((h) => h.id === handlerId);
    if (!current) return;
    this.applyDraft((dm) => dm.updateHandler(handlerId, { on: newOn, do: current.config.do }));
  }

  /**
   * Dodaj nową akcję do handler chainu. Każdy typ ma template z prefilled
   * placeholderami — user może potem zmienić przez edit.
   */
  addAction(handlerId: string, actionType: string): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().handlers.find((h) => h.id === handlerId);
    if (!current) return;

    const newAction = this.promptAction(actionType);
    if (!newAction) return;

    const newActions = [...current.config.do, newAction] as unknown as ReadonlyArray<never>;
    this.applyDraft((dm) => dm.updateHandler(handlerId, { on: current.config.on, do: newActions }));
  }

  /** Wywołaj dialog edycji istniejącej akcji (idx w chainie). */
  editAction(handlerId: string, actionIdx: number): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().handlers.find((h) => h.id === handlerId);
    if (!current) return;
    const action = current.config.do[actionIdx] as Record<string, unknown> | undefined;
    if (!action) return;

    // Wykryj typ akcji z istniejących pól
    const type =
      'emit' in action ? 'emit' :
      'setDatasource' in action ? 'setDatasource' :
      'clearDatasource' in action ? 'clearDatasource' :
      'callComputed' in action ? 'callComputed' :
      'fetch' in action ? 'fetch' :
      'call' in action ? 'call' : '';
    if (!type) {
      if (typeof window !== 'undefined') window.alert('Nieznany typ akcji — edycja niemożliwa');
      return;
    }

    const updated = this.promptAction(type, action);
    if (!updated) return;

    const newActions = current.config.do.map((a, i) => (i === actionIdx ? updated : a)) as unknown as ReadonlyArray<never>;
    this.applyDraft((dm) => dm.updateHandler(handlerId, { on: current.config.on, do: newActions }));
  }

  removeAction(handlerId: string, actionIdx: number): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().handlers.find((h) => h.id === handlerId);
    if (!current) return;
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć akcję #${actionIdx + 1}?`)) return;
    const newActions = current.config.do.filter((_, i) => i !== actionIdx) as unknown as ReadonlyArray<never>;
    this.applyDraft((dm) => dm.updateHandler(handlerId, { on: current.config.on, do: newActions }));
  }

  moveAction(handlerId: string, actionIdx: number, delta: number): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().handlers.find((h) => h.id === handlerId);
    if (!current) return;
    const targetIdx = actionIdx + delta;
    if (targetIdx < 0 || targetIdx >= current.config.do.length) return;
    const swapped = [...current.config.do];
    [swapped[actionIdx], swapped[targetIdx]] = [swapped[targetIdx]!, swapped[actionIdx]!];
    this.applyDraft((dm) => dm.updateHandler(handlerId, { on: current.config.on, do: swapped as unknown as ReadonlyArray<never> }));
  }

  /**
   * Kreator dla pojedynczej akcji — prompts user-a za wszystkie pola typu.
   * Jeśli `seed` podane, pola są pre-filled dla edycji istniejącej akcji.
   */
  private promptAction(type: string, seed: Record<string, unknown> = {}): Record<string, unknown> | null {
    if (typeof window === 'undefined') return null;

    const ask = (label: string, defaultValue?: string): string | null => {
      const r = window.prompt(label, defaultValue ?? '');
      if (r === null) return null;
      return r.trim();
    };

    switch (type) {
      case 'emit': {
        const eventName = ask('Event name (np. fx.quote.accepted):', seed['emit'] as string);
        if (!eventName) return null;
        const payload = ask('Payload (expression, np. $event albo $ds.foo — opcjonalny):', seed['payload'] as string | undefined);
        const action: Record<string, unknown> = { emit: eventName };
        if (payload) action['payload'] = payload;
        return action;
      }
      case 'setDatasource': {
        const targetId = ask('Target datasource ID:', seed['setDatasource'] as string);
        if (!targetId) return null;
        const from = ask('From (expression, np. $event):', (seed['from'] as string) ?? '$event');
        if (from === null) return null;
        const action: Record<string, unknown> = { setDatasource: targetId };
        if (from) action['from'] = from;
        return action;
      }
      case 'clearDatasource': {
        const targetId = ask('Datasource ID do wyczyszczenia:', seed['clearDatasource'] as string);
        if (!targetId) return null;
        return { clearDatasource: targetId };
      }
      case 'callComputed': {
        const fnId = ask('Computed function ID (z bootstrap/aggregate-functions):', seed['callComputed'] as string);
        if (!fnId) return null;
        const withArgs = ask('Arguments (comma-separated expressions, np. $event.spot,$event.side):', ((seed['with'] as string[] | undefined) ?? []).join(','));
        const into = ask('Into (target datasource ID — opcjonalne):', seed['into'] as string | undefined);
        const action: Record<string, unknown> = { callComputed: fnId };
        if (withArgs) action['with'] = withArgs.split(',').map((s) => s.trim()).filter(Boolean);
        if (into) action['into'] = into;
        return action;
      }
      case 'fetch': {
        const dsId = ask('Datasource ID do refetch:', seed['fetch'] as string);
        if (!dsId) return null;
        return { fetch: dsId };
      }
      case 'call': {
        const fnId = ask('Function ID:', seed['call'] as string);
        if (!fnId) return null;
        const withArg = ask('With (expression — opcjonalne):', seed['with'] as string | undefined);
        const action: Record<string, unknown> = { call: fnId };
        if (withArg) action['with'] = withArg;
        return action;
      }
      default:
        window.alert('Nieznany typ akcji: ' + type);
        return null;
    }
  }

  toggleFormField(fieldId: string): void {
    this.expandedFormFieldId.update((cur) => cur === fieldId ? null : fieldId);
  }

  addFormField(instanceId: string): void {
    const id = this.promptKey('field (np. clientName)');
    if (!id) return;
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId);
    if (!current) return;
    const currentOptions = (current.widget.options ?? {}) as Record<string, unknown>;
    const currentFields = Array.isArray(currentOptions['fields']) ? currentOptions['fields'] : [];
    const newField = { id, label: humanize(id), type: 'text' };
    const nextFields = [...currentFields, newField];
    this.applyDraft((dm) => dm.updateWidget(instanceId, { options: { ...currentOptions, fields: nextFields } }));
    this.expandedFormFieldId.set(id);
  }

  removeFormField(instanceId: string, fieldId: string): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć pole "${fieldId}"?`)) return;
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId);
    if (!current) return;
    const currentOptions = (current.widget.options ?? {}) as Record<string, unknown>;
    const currentFields = Array.isArray(currentOptions['fields']) ? currentOptions['fields'] : [];
    const nextFields = currentFields.filter((f) => (f as Record<string, unknown>)['id'] !== fieldId);
    this.applyDraft((dm) => dm.updateWidget(instanceId, { options: { ...currentOptions, fields: nextFields } }));
  }

  moveFormField(instanceId: string, fieldIdx: number, delta: number): void {
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId);
    if (!current) return;
    const currentOptions = (current.widget.options ?? {}) as Record<string, unknown>;
    const fields = Array.isArray(currentOptions['fields']) ? [...currentOptions['fields']] : [];
    const targetIdx = fieldIdx + delta;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    [fields[fieldIdx], fields[targetIdx]] = [fields[targetIdx], fields[fieldIdx]];
    this.applyDraft((dm) => dm.updateWidget(instanceId, { options: { ...currentOptions, fields } }));
  }

  onFormFieldIdChange(instanceId: string, oldId: string, event: Event): void {
    const newId = (event.target as HTMLInputElement).value.trim();
    if (!newId || newId === oldId) return;
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId);
    if (!current) return;
    const currentOptions = (current.widget.options ?? {}) as Record<string, unknown>;
    const fields = Array.isArray(currentOptions['fields']) ? currentOptions['fields'] : [];
    const nextFields = fields.map((f) => {
      const field = f as Record<string, unknown>;
      return field['id'] === oldId ? { ...field, id: newId } : field;
    });
    this.applyDraft((dm) => dm.updateWidget(instanceId, { options: { ...currentOptions, fields: nextFields } }));
    if (this.expandedFormFieldId() === oldId) this.expandedFormFieldId.set(newId);
  }

  onFormFieldChange(instanceId: string, fieldId: string, key: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    let value: unknown;
    if (target.type === 'checkbox') value = target.checked;
    else if (target.type === 'number') {
      const v = target.value;
      value = v === '' ? undefined : Number(v);
    } else {
      value = target.value || undefined;
    }
    const m = this.draftModel();
    if (!m) return;
    const current = m.snapshot().widgets.find((w) => w.id === instanceId);
    if (!current) return;
    const currentOptions = (current.widget.options ?? {}) as Record<string, unknown>;
    const fields = Array.isArray(currentOptions['fields']) ? currentOptions['fields'] : [];
    const nextFields = fields.map((f) => {
      const field = f as Record<string, unknown>;
      if (field['id'] !== fieldId) return field;
      const copy = { ...field };
      if (value === undefined || value === '' || value === false) delete copy[key];
      else copy[key] = value;
      return copy;
    });
    this.applyDraft((dm) => dm.updateWidget(instanceId, { options: { ...currentOptions, fields: nextFields } }));
  }

  deleteInspectedWidget(): void {
    const id = this.inspectedInstanceId();
    if (!id) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Usunąć widget "${id}"?`);
      if (!confirmed) return;
    }
    this.applyDraft((dm) => dm.removeWidget(id));
    this.inspectedInstanceId.set(null);
  }

  /**
   * Globalny keyboard handler — działa na całą stronę designera.
   * Skróty:
   *   /                  — focus palette filter
   *   Ctrl/Cmd + Z       — undo
   *   Ctrl/Cmd + Shift+Z — redo
   *   Ctrl/Cmd + Y       — redo (alternatywa Windows)
   *   Esc                — cofnij zaznaczenie widgetu / schowaj filter
   *   Delete / Backspace — usuń zaznaczony widget (tylko gdy focus poza inputem)
   *   Ctrl/Cmd + E       — toggle edit mode
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (event.key === '/' && !inInput) {
      event.preventDefault();
      this.focusFilter();
      return;
    }

    const ctrl = event.ctrlKey || event.metaKey;

    if (ctrl && (event.key === 'z' || event.key === 'Z')) {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }

    if (ctrl && (event.key === 'y' || event.key === 'Y')) {
      event.preventDefault();
      this.redo();
      return;
    }

    if (ctrl && (event.key === 'e' || event.key === 'E')) {
      event.preventDefault();
      this.toggleEditMode();
      return;
    }

    if (event.key === 'Escape') {
      if (inInput) return; // natywne clear searcha
      this.inspectedInstanceId.set(null);
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && !inInput && this.editMode() && this.inspectedInstanceId()) {
      event.preventDefault();
      this.deleteInspectedWidget();
      return;
    }

    // Shift + arrows — przesuwa zaznaczony widget po gridzie (tylko edit mode, widget selected)
    if (event.shiftKey && !inInput && this.editMode() && this.inspectedInstanceId()) {
      const id = this.inspectedInstanceId()!;
      const iw = this.inspectedWidget();
      if (!iw) return;
      const curX = iw.layout.x ?? 0;
      const curY = iw.layout.y ?? 0;
      const curW = iw.layout.w ?? 12;
      const curH = iw.layout.h ?? 1;

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.applyDraft((dm) => dm.moveWidget(id, { y: Math.max(0, curY - 1) }));
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.applyDraft((dm) => dm.moveWidget(id, { y: curY + 1 }));
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.applyDraft((dm) => dm.moveWidget(id, { x: Math.max(0, curX - 1) }));
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.applyDraft((dm) => dm.moveWidget(id, { x: Math.min(12 - curW, curX + 1) }));
        return;
      }

      // Ctrl/Cmd + Shift + arrows — resize
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.applyDraft((dm) => dm.moveWidget(id, { w: Math.max(1, curW - 1) }));
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.applyDraft((dm) => dm.moveWidget(id, { w: Math.min(12 - curX, curW + 1) }));
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.applyDraft((dm) => dm.moveWidget(id, { h: curH + 1 }));
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.applyDraft((dm) => dm.moveWidget(id, { h: Math.max(1, curH - 1) }));
          return;
        }
      }
    }
  }

  private focusFilter(): void {
    if (typeof document === 'undefined') return;
    const el = document.querySelector<HTMLInputElement>('.palette-filter');
    el?.focus();
    el?.select();
  }

  private readonly destroyRef = inject(DestroyRef);

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

function isPrimitive(v: unknown): boolean {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/**
 * Serializacja DraftPage → PageConfig — do zapisania w storze. Odwrotna
 * operacja do PageDesignerModel.fromPageConfig.
 */
function buildConfigFromDraft(draft: { id: string; title: string; widgets: readonly { id: string; type: string; layout: { widget: string; x?: number; y?: number; w?: number; h?: number }; widget: unknown }[]; datasources?: readonly { id: string; config: unknown }[]; computed?: readonly { id: string; config: unknown }[]; handlers?: readonly { id: string; config: unknown }[] }, schemaVersion: PageConfig['$schemaVersion']): PageConfig {
  const layoutItems = draft.widgets.map((w) => ({
    widget: w.id,
    ...(w.layout.x !== undefined ? { x: w.layout.x } : {}),
    ...(w.layout.y !== undefined ? { y: w.layout.y } : {}),
    ...(w.layout.w !== undefined ? { w: w.layout.w } : {}),
    ...(w.layout.h !== undefined ? { h: w.layout.h } : {}),
  }));
  const widgets = Object.fromEntries(draft.widgets.map((w) => [w.id, w.widget]));
  const page: Record<string, unknown> = {
    id: draft.id,
    title: draft.title,
    layout: { type: 'grid', items: layoutItems },
    widgets,
  };
  if (draft.datasources && draft.datasources.length > 0) {
    page['datasources'] = Object.fromEntries(draft.datasources.map((d) => [d.id, d.config]));
  }
  if (draft.computed && draft.computed.length > 0) {
    page['computed'] = Object.fromEntries(draft.computed.map((c) => [c.id, c.config]));
  }
  if (draft.handlers && draft.handlers.length > 0) {
    page['eventHandlers'] = draft.handlers.map((h) => h.config);
  }
  return { $schemaVersion: schemaVersion, page: page as never } as PageConfig;
}

/**
 * Szablony dla nowych stron — minimalne kompozycje widgetów frameworkowych.
 * Każdy zwraca kompletny PageConfig który może być od razu edytowany w draft model.
 */
function buildTemplateConfig(id: string, title: string, template: 'empty' | 'list' | 'dashboard' | 'form'): PageConfig {
  const schemaVersion = '2026.04-alpha' as PageConfig['$schemaVersion'];
  switch (template) {
    case 'list':
      return {
        $schemaVersion: schemaVersion,
        page: {
          id, title,
          layout: { type: 'grid', items: [
            { widget: 'title', x: 0, y: 0, w: 12 },
            { widget: 'list', x: 0, y: 1, w: 5 },
            { widget: 'detail', x: 5, y: 1, w: 7 },
          ] },
          widgets: {
            title: { type: 'page-title', options: { title, subtitle: 'Nowa strona — uzupełnij' } },
            list: { type: 'data-table', bind: { rows: '$ds.YOUR_DATASOURCE' } },
            detail: { type: 'info-card', bind: { data: '$local.selected' } },
          },
        },
      };
    case 'dashboard':
      return {
        $schemaVersion: schemaVersion,
        page: {
          id, title,
          layout: { type: 'grid', items: [
            { widget: 'title', x: 0, y: 0, w: 12 },
            { widget: 'stat1', x: 0, y: 1, w: 4 },
            { widget: 'stat2', x: 4, y: 1, w: 4 },
            { widget: 'stat3', x: 8, y: 1, w: 4 },
            { widget: 'chart', x: 0, y: 2, w: 12 },
          ] },
          widgets: {
            title: { type: 'page-title', options: { title } },
            stat1: { type: 'stat-tile', options: { label: 'KPI 1', value: 0 } },
            stat2: { type: 'stat-tile', options: { label: 'KPI 2', value: 0 } },
            stat3: { type: 'stat-tile', options: { label: 'KPI 3', value: 0 } },
            chart: { type: 'candlestick-chart', options: { xField: 'timestamp' } },
          },
        },
      };
    case 'form':
      return {
        $schemaVersion: schemaVersion,
        page: {
          id, title,
          layout: { type: 'grid', items: [
            { widget: 'title', x: 0, y: 0, w: 12 },
            { widget: 'form', x: 0, y: 1, w: 8 },
            { widget: 'actions', x: 0, y: 5, w: 8 },
          ] },
          widgets: {
            title: { type: 'page-title', options: { title } },
            form: { type: 'validated-form', options: { fields: [] } },
            actions: { type: 'actions-bar', options: { actions: [{ id: 'save', label: 'Zapisz' }] } },
          },
        },
      };
    default:
      return {
        $schemaVersion: schemaVersion,
        page: {
          id, title,
          layout: { type: 'grid', items: [{ widget: 'title', x: 0, y: 0, w: 12 }] },
          widgets: {
            title: { type: 'page-title', options: { title, subtitle: 'Pusta strona' } },
          },
        },
      };
  }
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
