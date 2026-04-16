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
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { EchelonWidget, WIDGET_REGISTRY } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { PageConfig, WidgetManifest, WidgetRegistry } from '@echelon-framework/core';
import { PageDesignerModel, serialize } from '@echelon-framework/designer-page';
import { DraftPageStoreService } from '../services/draft-page-store.service';

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
                      [disabled]="!editMode()">
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
                @if (editMode()) {
                  <button type="button" class="btn-mini" (click)="addFormField(iw.instanceId)" title="Dodaj pole formularza">+ field</button>
                }
              </div>
              <div class="fb-fields">
                @for (f of formFields(); track f.id; let fi = $index) {
                  <div class="fb-field" [class.expanded]="expandedFormFieldId() === f.id">
                    <div class="fb-field-header" (click)="toggleFormField(f.id)">
                      <span class="fb-caret">{{ expandedFormFieldId() === f.id ? '▾' : '▸' }}</span>
                      <span class="fb-type">{{ f.type }}</span>
                      <span class="fb-id">{{ f.id }}</span>
                      @if (f.required) { <span class="fb-badge">req</span> }
                      @if (editMode()) {
                        <span class="action-controls">
                          <button type="button" class="btn-tiny" (click)="moveFormField(iw.instanceId, fi, -1); $event.stopPropagation()" title="Do góry">↑</button>
                          <button type="button" class="btn-tiny" (click)="moveFormField(iw.instanceId, fi, 1); $event.stopPropagation()" title="W dół">↓</button>
                          <button type="button" class="btn-tiny danger" (click)="removeFormField(iw.instanceId, f.id); $event.stopPropagation()" title="Usuń pole">✕</button>
                        </span>
                      }
                    </div>
                    @if (expandedFormFieldId() === f.id && editMode()) {
                      <div class="fb-field-body">
                        <label class="fb-label"><span>id</span><input type="text" class="inline-edit" [value]="f.id" (change)="onFormFieldIdChange(iw.instanceId, f.id, $event)"/></label>
                        <label class="fb-label"><span>label</span><input type="text" class="inline-edit" [value]="f.label" (change)="onFormFieldChange(iw.instanceId, f.id, 'label', $event)"/></label>
                        <label class="fb-label"><span>type</span>
                          <select class="inline-edit" [value]="f.type" (change)="onFormFieldChange(iw.instanceId, f.id, 'type', $event)">
                            <option value="text">text</option>
                            <option value="number">number</option>
                            <option value="decimal">decimal</option>
                            <option value="email">email</option>
                            <option value="password">password</option>
                            <option value="checkbox">checkbox</option>
                            <option value="select">select</option>
                            <option value="textarea">textarea</option>
                            <option value="date">date</option>
                          </select>
                        </label>
                        <label class="fb-label"><span>placeholder</span><input type="text" class="inline-edit" [value]="f.placeholder ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'placeholder', $event)"/></label>
                        <label class="fb-label"><span>hint</span><input type="text" class="inline-edit" [value]="f.hint ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'hint', $event)"/></label>
                        <label class="fb-label"><span>section</span><input type="text" class="inline-edit" [value]="f.section ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'section', $event)"/></label>
                        <div class="fb-inline">
                          <label class="fb-check"><input type="checkbox" [checked]="!!f.required" (change)="onFormFieldChange(iw.instanceId, f.id, 'required', $event)"/> required</label>
                          <label class="fb-check"><input type="checkbox" [checked]="!!f.readonly" (change)="onFormFieldChange(iw.instanceId, f.id, 'readonly', $event)"/> readonly</label>
                        </div>
                        <div class="fb-validators">
                          <div class="fb-label-small">Walidacja:</div>
                          <div class="fb-grid">
                            <label class="fb-label"><span>min</span><input type="number" class="inline-edit" [value]="f.min ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'min', $event)"/></label>
                            <label class="fb-label"><span>max</span><input type="number" class="inline-edit" [value]="f.max ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'max', $event)"/></label>
                            <label class="fb-label"><span>minLength</span><input type="number" class="inline-edit" [value]="f.minLength ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'minLength', $event)"/></label>
                            <label class="fb-label"><span>maxLength</span><input type="number" class="inline-edit" [value]="f.maxLength ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'maxLength', $event)"/></label>
                          </div>
                          <label class="fb-label"><span>pattern (regex)</span><input type="text" class="inline-edit" [value]="f.pattern ?? ''" (change)="onFormFieldChange(iw.instanceId, f.id, 'pattern', $event)"/></label>
                        </div>
                      </div>
                    }
                  </div>
                }
                @if (formFields().length === 0) {
                  <div class="muted small">Brak pól — dodaj pierwsze klikiem "+ field"</div>
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
            </div>
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

          <div class="inspector-block">
            <div class="inspector-section">
              Datasources
              <span class="count-pill">{{ pageDatasources().length }}</span>
              @if (editMode()) {
                <button type="button" class="btn-mini" (click)="addDatasource()" title="Dodaj datasource">+ ds</button>
              }
            </div>
            <div class="widget-list">
              @for (ds of pageDatasources(); track ds.id) {
                <div class="ds-row">
                  <div class="ds-main">
                    <span class="wli-id">{{ ds.id }}</span>
                    <span class="wli-type">{{ ds.kind }}{{ ds.transport ? ' : ' + ds.transport : '' }}{{ ds.endpoint ? ' → ' + ds.endpoint : '' }}</span>
                  </div>
                  @if (editMode()) {
                    <button type="button" class="btn-rm" (click)="removeDatasource(ds.id)" title="Usuń">✕</button>
                  }
                </div>
              }
              @if (pageDatasources().length === 0) {
                <div class="muted small">Strona nie używa datasources</div>
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

    .edit-controls { display: flex; gap: 4px; margin-left: 10px; }
    .btn-edit, .btn-undo, .btn-redo { padding: 4px 10px; background: transparent; border: 1px solid var(--border, #374151); color: var(--muted, #9ca3af); border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; }
    .btn-edit:hover, .btn-undo:hover:not(:disabled), .btn-redo:hover:not(:disabled) { border-color: #58a6ff; color: var(--fg, #e5e7eb); }
    .btn-edit.on { background: #064e3b; border-color: #10b981; color: #d1fae5; }
    .btn-undo:disabled, .btn-redo:disabled { opacity: 0.3; cursor: not-allowed; }

    .inline-edit { width: 100%; padding: 3px 6px; background: #0b1120; border: 1px solid #58a6ff; color: var(--fg, #e5e7eb); border-radius: 2px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; box-sizing: border-box; }
    .inline-edit:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 1px #93c5fd44; }
    .inline-edit.full { width: 100%; }

    .bind-row { display: flex; gap: 4px; align-items: center; }
    .btn-mini { padding: 1px 6px; font-size: 9px; background: #1f2937; border: 1px solid var(--border, #374151); color: var(--muted, #9ca3af); border-radius: 2px; cursor: pointer; font-family: inherit; margin-left: 6px; }
    .btn-mini:hover { border-color: #58a6ff; color: var(--fg, #e5e7eb); }
    .btn-rm { padding: 0 4px; font-size: 10px; background: transparent; border: none; color: #ef4444; cursor: pointer; opacity: 0.6; }
    .btn-rm:hover { opacity: 1; }

    .palette-hint { font-size: 10px; color: #10b981; padding: 4px 6px; background: #064e3b33; border-radius: 3px; margin-bottom: 8px; text-align: center; }
    .palette-hint.muted-hint { color: var(--muted, #9ca3af); background: #1f2937; }
    .palette-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .palette-item:disabled:hover { background: transparent; border-color: transparent; }

    .inspector-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .btn-danger { padding: 4px 10px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fee2e2; border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; flex-shrink: 0; }
    .btn-danger:hover { background: #7f1d1d66; }

    .shortcuts-help { margin: -4px 0 12px; padding: 6px 10px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 4px; font-size: 10px; }
    .shortcuts-help summary { cursor: pointer; color: var(--muted, #9ca3af); user-select: none; font-size: 11px; }
    .shortcuts-help summary:hover { color: var(--fg, #e5e7eb); }
    .shortcuts-help dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 8px 0 0; }
    .shortcuts-help dt { white-space: nowrap; color: var(--muted, #9ca3af); }
    .shortcuts-help dd { margin: 0; color: var(--fg, #e5e7eb); }
    kbd { display: inline-block; padding: 1px 5px; background: #1f2937; border: 1px solid var(--border, #374151); border-radius: 2px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #93c5fd; }
    kbd + kbd { margin-left: 1px; }

    .layout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
    .layout-grid label { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--muted, #9ca3af); }
    .layout-grid input { width: 100%; }
    .layout-actions { display: flex; gap: 3px; flex-wrap: wrap; }

    .btn-save { padding: 4px 10px; background: #064e3b33; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 11px; cursor: pointer; font-family: inherit; }
    .btn-save:hover:not(:disabled) { background: #064e3b66; }
    .btn-save:disabled { opacity: 0.3; cursor: not-allowed; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 6px; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border, #1f2937); font-weight: 600; color: var(--accent, #58a6ff); }
    .btn-close { background: transparent; border: none; color: var(--muted, #9ca3af); font-size: 16px; cursor: pointer; padding: 2px 6px; }
    .btn-close:hover { color: var(--fg, #e5e7eb); }
    .modal-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .save-target { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
    .save-target-line { display: flex; gap: 8px; align-items: center; }
    .save-target code { background: #1f2937; padding: 2px 6px; border-radius: 2px; color: #93c5fd; font-size: 11px; }
    .save-preview { margin: 0; padding: 12px; background: #0b1120; border: 1px solid var(--border, #1f2937); border-radius: 4px; font-size: 11px; line-height: 1.5; color: #d1d5db; max-height: 400px; overflow: auto; }
    .save-actions { display: flex; gap: 8px; align-items: center; }
    .btn-primary { padding: 6px 14px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-primary:hover { background: #1e40af; }
    .save-copied { color: #10b981; font-size: 12px; font-weight: 600; animation: flash 0.3s; }
    @keyframes flash { from { opacity: 0; } to { opacity: 1; } }
    .save-roadmap { padding: 10px 12px; background: #713f1233; border-left: 3px solid #f59e0b; border-radius: 2px; font-size: 11px; color: #fef3c7; }
    .save-roadmap code { background: #1f2937; padding: 1px 4px; border-radius: 2px; color: #fcd34d; }

    .btn-new { padding: 4px 10px; background: #1e3a5f33; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; margin-left: 4px; }
    .btn-new:hover { background: #1e3a5f66; }

    .modal-sm { max-width: 500px; }
    .form-label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted, #9ca3af); }
    .form-label span { font-weight: 600; }
    .form-label small { font-size: 10px; font-style: italic; }
    .form-error { padding: 6px 10px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fee2e2; border-radius: 3px; font-size: 12px; }

    .count-pill { background: #1f2937; color: var(--muted, #9ca3af); font-size: 9px; padding: 1px 6px; border-radius: 8px; margin-left: 4px; font-weight: normal; }
    .ro-badge { margin-left: auto; background: #713f1233; color: #fcd34d; font-size: 9px; padding: 1px 6px; border-radius: 8px; font-weight: 500; }
    .ds-row { display: flex; align-items: center; gap: 4px; padding: 5px 8px; background: transparent; border: 1px solid transparent; border-radius: 3px; font-size: 11px; margin-bottom: 2px; }
    .ds-row:hover { background: #1a2332; border-color: var(--border, #374151); }
    .ds-main { flex: 1; display: flex; align-items: center; gap: 8px; }

    .handler-list { display: flex; flex-direction: column; gap: 6px; }
    .handler-card { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 3px; transition: border-color 0.15s; }
    .handler-card.expanded { border-color: #58a6ff; }
    .handler-header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer; user-select: none; }
    .handler-header:hover { background: #1a2332; }
    .handler-caret { font-size: 9px; color: var(--muted, #6b7280); width: 10px; }
    .handler-body { padding: 0 12px 10px; border-top: 1px solid var(--border, #1f2937); }

    .event-on-row { display: flex; align-items: center; gap: 6px; margin: 10px 0 12px; }
    .form-label-inline { font-size: 10px; color: var(--muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; min-width: 70px; }

    .action-chain { display: flex; flex-direction: column; gap: 4px; }
    .action-card { background: #1a2332; border-left: 2px solid #a78bfa; border-radius: 3px; padding: 5px 8px; font-size: 11px; }
    .action-header { display: flex; align-items: center; gap: 6px; }
    .action-type { font-weight: 600; color: #a78bfa; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; background: #5b21b633; padding: 1px 6px; border-radius: 2px; }
    .action-value { flex: 1; color: #d1d5db; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
    .action-controls { display: flex; gap: 2px; }
    .btn-tiny { padding: 0 5px; font-size: 10px; background: transparent; border: 1px solid transparent; color: var(--muted, #9ca3af); border-radius: 2px; cursor: pointer; font-family: inherit; min-width: 18px; }
    .btn-tiny:hover { background: #1f2937; border-color: var(--border, #374151); color: var(--fg, #e5e7eb); }
    .btn-tiny.danger:hover { color: #ef4444; border-color: #ef4444; }

    .action-add-row { display: flex; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border, #1f2937); }
    .action-add-row select { flex: 1; font-size: 11px; }
    .btn-primary.small { padding: 4px 10px; font-size: 11px; }

    .form-builder-block { border-color: #10b981; background: #064e3b0a; }
    .fb-fields { display: flex; flex-direction: column; gap: 4px; }
    .fb-field { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-left: 2px solid #10b981; border-radius: 3px; }
    .fb-field.expanded { border-color: #58a6ff; border-left-color: #10b981; }
    .fb-field-header { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: pointer; user-select: none; font-size: 11px; }
    .fb-field-header:hover { background: #1a2332; }
    .fb-caret { font-size: 9px; color: var(--muted, #6b7280); width: 10px; }
    .fb-type { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; background: #064e3b33; color: #10b981; padding: 1px 6px; border-radius: 2px; font-weight: 600; }
    .fb-id { flex: 1; color: #93c5fd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .fb-badge { background: #7f1d1d; color: #fee2e2; font-size: 9px; padding: 1px 5px; border-radius: 2px; font-weight: 600; }
    .fb-field-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--border, #1f2937); background: #0b1120; }
    .fb-label { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--muted, #9ca3af); }
    .fb-label span { text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .fb-label-small { font-size: 10px; color: var(--muted, #6b7280); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .fb-inline { display: flex; gap: 12px; }
    .fb-check { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--fg, #e5e7eb); cursor: pointer; }
    .fb-check input { margin: 0; }
    .fb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .fb-validators { padding-top: 6px; border-top: 1px dashed var(--border, #1f2937); }

    .draft-preview-notice { width: 100%; flex: 1; min-height: 500px; background: var(--panel-alt, #111827); border: 1px solid var(--border, #374151); border-radius: 0 0 4px 4px; padding: 40px 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
    .draft-icon { font-size: 48px; opacity: 0.6; }
    .draft-title { font-size: 16px; font-weight: 600; color: #fcd34d; }
    .draft-desc { font-size: 13px; color: var(--muted, #9ca3af); max-width: 500px; line-height: 1.5; }
    .draft-actions { display: flex; gap: 10px; margin-top: 10px; }
    .draft-actions button { padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 4px; font-family: inherit; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); }
    .draft-actions button.primary { background: #1e3a5f; border-color: #3b82f6; color: #e0f2fe; }
    .draft-actions button:hover { border-color: #58a6ff; }
    .draft-hint { max-width: 500px; font-size: 11px; color: var(--muted, #9ca3af); text-align: left; background: #0b1120; padding: 10px 14px; border-radius: 4px; border-left: 3px solid #f59e0b; }
    .draft-hint ol { margin: 6px 0 0; padding-left: 20px; line-height: 1.8; }
    .draft-hint code { background: #1f2937; padding: 1px 5px; border-radius: 2px; color: #93c5fd; font-size: 11px; }
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
  readonly viewMode = signal<'preview' | 'source-ts' | 'source-json'>('source-ts');
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
  readonly canUndo = signal<boolean>(false);
  readonly canRedo = signal<boolean>(false);
  /** Licznik zmian — zwiększany po każdym apply żeby wymusić re-render computed. */
  private readonly draftVersion = signal<number>(0);
  /** Save dialog state. */
  readonly saveDialogOpen = signal<boolean>(false);
  readonly saveCopied = signal<boolean>(false);

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
    return highlightSource(this.generatedSource(), this.viewMode());
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
    // Drafty mają teraz dynamic route /draft/:id — iframe renderuje je
    // przez DraftPageRendererComponent (czyta z localStorage). Nie ma
    // więcej infinite recursion problemu.
    // ?embed=1 — AppComponent chowa shell (menu+sidebar), pokazuje sam content.
    const bust = this.reloadTrigger();
    const separator = p.route.includes('?') ? '&' : '?';
    const url = `${p.route}${separator}embed=1${bust > 0 ? `&_reload=${bust}` : ''}`;
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
    this.applyDraft((dm) =>
      dm.addWidget({
        id: instanceId,
        type,
        layout: { widget: instanceId, x: 0, y: nextY, w: 12 },
        widget: { type },
      }),
    );
    this.inspectedInstanceId.set(instanceId);
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

  resizeFull(instanceId: string): void {
    this.applyDraft((dm) => dm.moveWidget(instanceId, { w: 12, x: 0 }));
  }

  resizeHalf(instanceId: string): void {
    this.applyDraft((dm) => dm.moveWidget(instanceId, { w: 6 }));
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
    const id = this.promptKey('datasource (np. clientsList)');
    if (!id) return;
    const kindRaw = (typeof window !== 'undefined') ? window.prompt('Kind (transport/local/computed):', 'transport') : 'transport';
    const kind = (kindRaw === 'local' || kindRaw === 'computed' || kindRaw === 'transport') ? kindRaw : 'transport';
    this.applyDraft((dm) =>
      dm.addDatasource({
        id,
        config: kind === 'local'
          ? { kind: 'local' }
          : kind === 'computed'
          ? { kind: 'computed', fn: 'TODO', inputs: [] }
          : { kind: 'transport', transport: 'http', endpoint: `/${id}` },
      }),
    );
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
