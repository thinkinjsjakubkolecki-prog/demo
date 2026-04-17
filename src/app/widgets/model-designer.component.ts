/**
 * fx-model-designer — kreator modeli danych.
 *
 * Model = jedno źródło prawdy o kształcie danych. Referencjonowany przez:
 *  - DataSource (outputSchema → Model, inputSchema → Model)
 *  - Formularz (inputContract.schema → Model)
 *
 * Zmiana modelu propaguje się w dół pipeline:
 *   Model → DS → Strona → Formularz
 */
import { computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { DraftModelStoreService, type DraftModel, type ModelField, type ModelRelation } from '../services/draft-model-store.service';
import type { PropertyType } from '../services/schema-types';

@EchelonWidget({
  manifest: {
    type: 'model-designer',
    version: '1.0.0',
    category: 'designer',
    description: 'Kreator modeli danych — pola, typy, walidacje, relacje.',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: {},
    testability: { interactions: [], observables: ['model-designer'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-model-designer',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" data-testid="model-designer" data-echelon-state="ready">
      <div class="toolbar">
        <h2>🧩 Modele danych</h2>
        <div class="meta">
          <span>{{ modelStore.all().length }} modeli</span>
          <span class="sep">·</span>
          <span>{{ totalFields() }} pól łącznie</span>
        </div>
        <input type="search" class="search" placeholder="Szukaj..."
               [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
        <button type="button" class="btn-new" (click)="openCreateDialog()">+ Nowy model</button>
      </div>

      @if (createOpen()) {
        <div class="modal-backdrop" (click)="closeCreateDialog()"></div>
        <div class="modal">
          <div class="modal-header">
            <h3>+ Nowy model danych</h3>
            <button type="button" class="btn-close" (click)="closeCreateDialog()">✕</button>
          </div>
          <div class="modal-body">
            <label class="field"><span class="field-label">ID</span>
              <input type="text" [ngModel]="newId()" (ngModelChange)="newId.set($event)" placeholder="np. Client" /></label>
            <label class="field"><span class="field-label">Nazwa</span>
              <input type="text" [ngModel]="newTitle()" (ngModelChange)="newTitle.set($event)" placeholder="np. Klient" /></label>
            <label class="field"><span class="field-label">Opis</span>
              <input type="text" [ngModel]="newDesc()" (ngModelChange)="newDesc.set($event)" placeholder="Model danych klienta" /></label>
            @if (createError()) { <div class="error-box">{{ createError() }}</div> }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" (click)="closeCreateDialog()">Anuluj</button>
            <button type="button" class="btn-primary" (click)="createModel()">Utwórz</button>
          </div>
        </div>
      }

      <div class="layout">
        <aside class="list">
          <div class="list-header">Modele</div>
          @for (m of filteredModels(); track m.id) {
            <button type="button" class="model-item"
                    [class.active]="selectedId() === m.id"
                    (click)="select(m.id)">
              <div class="model-line-1">
                <span class="model-id">{{ m.id }}</span>
                <span class="model-count">{{ m.fields.length }} pól</span>
              </div>
              <div class="model-line-2">{{ m.title }}</div>
            </button>
          }
          @if (filteredModels().length === 0) {
            <div class="empty">Brak modeli — kliknij "+ Nowy model"</div>
          }
        </aside>

        <main class="detail">
          @if (selectedModel(); as model) {
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ model.title }}</div>
                <div class="detail-sub">
                  <code>{{ model.id }}</code>
                  @if (model.description) { · {{ model.description }} }
                </div>
              </div>
              <div class="detail-actions">
                <button type="button" class="btn-danger" (click)="deleteModel(model.id)">🗑 Usuń</button>
              </div>
            </div>

            <!-- RELACJE -->
            @if (relations().length > 0) {
              <div class="relations-section">
                <div class="rel-header">🔗 Relacje</div>
                @for (r of relations(); track r.modelId + r.fieldId) {
                  <div class="rel-row">
                    @if (r.direction === 'outgoing') {
                      <span class="rel-this">{{ model.id }}.{{ r.fieldId }}</span>
                      <span class="rel-arrow">→</span>
                      <span class="rel-target">{{ r.modelId }}</span>
                      <span class="rel-kind">{{ r.kind }}</span>
                    } @else {
                      <span class="rel-target">{{ r.sourceModelId }}.{{ r.fieldId }}</span>
                      <span class="rel-arrow">→</span>
                      <span class="rel-this">{{ model.id }}</span>
                      <span class="rel-kind">{{ r.kind }}</span>
                    }
                  </div>
                }
              </div>
            }

            <!-- POLA -->
            <div class="fields-section">
              <div class="fields-header">
                Pola <span class="count-pill">{{ model.fields.length }}</span>
                <button type="button" class="btn-add" (click)="addField()">+ pole</button>
              </div>
              <div class="fields-table">
                <div class="ft-row header">
                  <span>ID</span><span>Label</span><span>Typ</span><span>PK</span><span>Req</span><span>Uniq</span><span>Enum / Ref</span><span>Opis</span><span></span>
                </div>
                @for (f of model.fields; track f.id; let i = $index) {
                  <div class="ft-row" [class.pk]="f.primaryKey">
                    <input type="text" [value]="f.id" (change)="updateFieldProp(i, 'id', $any($event.target).value)" />
                    <input type="text" [value]="f.label ?? ''" (change)="updateFieldProp(i, 'label', $any($event.target).value)" />
                    <select [value]="f.type" (change)="updateFieldProp(i, 'type', $any($event.target).value)">
                      @for (t of propTypes; track t) { <option [value]="t">{{ t }}</option> }
                    </select>
                    <input type="checkbox" [checked]="!!f.primaryKey" (change)="updateFieldProp(i, 'primaryKey', $any($event.target).checked)" />
                    <input type="checkbox" [checked]="!!f.required" (change)="updateFieldProp(i, 'required', $any($event.target).checked)" />
                    <input type="checkbox" [checked]="!!f.unique" (change)="updateFieldProp(i, 'unique', $any($event.target).checked)" />
                    <input type="text" [value]="fieldExtra(f)" (change)="updateFieldExtra(i, f, $any($event.target).value)" [placeholder]="fieldExtraPlaceholder(f)" />
                    <input type="text" [value]="f.description ?? ''" (change)="updateFieldProp(i, 'description', $any($event.target).value)" />
                    <div class="ft-actions">
                      <button type="button" class="btn-tiny" (click)="moveField(i, -1)" [disabled]="i === 0">↑</button>
                      <button type="button" class="btn-tiny" (click)="moveField(i, 1)" [disabled]="i === model.fields.length - 1">↓</button>
                      <button type="button" class="btn-rm" (click)="removeField(i)">✕</button>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- SCHEMA PREVIEW -->
            <div class="schema-preview">
              <div class="sp-header">TypeScript preview</div>
              <pre class="sp-code">{{ tsPreview() }}</pre>
            </div>

            <!-- GDZIE UŻYWANY -->
            <div class="usage-section">
              <div class="usage-header">📌 Gdzie używany</div>
              @if (usedBy().length > 0) {
                @for (u of usedBy(); track u.id + u.context) {
                  <div class="usage-row">
                    <span class="usage-kind">{{ u.kind }}</span>
                    <span class="usage-id">{{ u.id }}</span>
                    <span class="usage-ctx">{{ u.context }}</span>
                  </div>
                }
              } @else {
                <div class="usage-empty">Model nie jest jeszcze referencjonowany przez żaden DS ani formularz.</div>
              }
            </div>

          } @else {
            <div class="detail-empty">
              <div class="empty-icon">🧩</div>
              <div class="empty-title">Wybierz model z listy</div>
              <div class="empty-desc">Model to jedno źródło prawdy o kształcie danych. DS i formularze referencjonują modele zamiast duplikować definicje typów.</div>
            </div>
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 16px; color: var(--fg, #e5e7eb); height: 100%; }
    .wrap { display: flex; flex-direction: column; height: 100%; background: var(--panel, #0f172a); border: 1px solid var(--border, #1f2937); border-radius: 6px; }

    .toolbar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--border, #1f2937); }
    .toolbar h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--accent, #58a6ff); }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted, #9ca3af); }
    .sep { color: var(--muted, #6b7280); }
    .search { flex: 1; max-width: 240px; padding: 6px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 12px; }
    .btn-new { margin-left: auto; padding: 6px 14px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-new:hover { background: #065f46; }

    .layout { display: grid; grid-template-columns: 260px 1fr; flex: 1; min-height: 0; }
    .list { background: var(--panel-alt, #111827); border-right: 1px solid var(--border, #1f2937); overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 3px; }
    .list-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); padding: 4px 8px 8px; font-weight: 600; }
    .empty { padding: 20px 10px; text-align: center; font-size: 12px; color: var(--muted, #9ca3af); font-style: italic; }

    .model-item { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-left: 3px solid #8b5cf6; border-radius: 3px; padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 2px; color: var(--fg, #e5e7eb); font-family: inherit; }
    .model-item:hover { border-color: #58a6ff66; }
    .model-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #8b5cf6; }
    .model-line-1 { display: flex; align-items: center; gap: 6px; }
    .model-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #c4b5fd; flex: 1; }
    .model-count { font-size: 9px; color: var(--muted, #9ca3af); background: #1f2937; padding: 1px 6px; border-radius: 2px; }
    .model-line-2 { font-size: 10px; color: var(--muted, #6b7280); }

    .detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border, #1f2937); }
    .detail-title { font-size: 18px; font-weight: 700; color: var(--fg, #e5e7eb); }
    .detail-sub { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 2px; }
    .detail-sub code { background: #1f2937; padding: 1px 5px; border-radius: 2px; color: #c4b5fd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .detail-actions { display: flex; gap: 6px; }
    .btn-primary { padding: 6px 14px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-danger { padding: 6px 12px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-ghost { padding: 6px 14px; background: transparent; border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 3px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .btn-close { background: transparent; border: none; color: var(--muted, #9ca3af); font-size: 18px; cursor: pointer; padding: 4px 8px; }
    .btn-add { margin-left: auto; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; padding: 2px 10px; border-radius: 2px; cursor: pointer; font-size: 10px; font-family: inherit; letter-spacing: 0; text-transform: none; }
    .btn-tiny { background: transparent; border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); width: 20px; height: 20px; padding: 0; border-radius: 2px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; }
    .btn-tiny:disabled { opacity: 0.3; cursor: not-allowed; }
    .btn-rm { background: transparent; border: 1px solid #7f1d1d66; color: #fca5a5; width: 20px; height: 20px; padding: 0; border-radius: 2px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; }

    .relations-section { background: var(--panel-alt, #111827); border: 1px solid #8b5cf633; border-radius: 4px; padding: 10px; }
    .rel-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #c4b5fd; font-weight: 600; margin-bottom: 6px; }
    .rel-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: #0b1120; border-radius: 3px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-bottom: 2px; }
    .rel-this { color: #c4b5fd; font-weight: 600; }
    .rel-target { color: #93c5fd; }
    .rel-arrow { color: var(--muted, #6b7280); }
    .rel-kind { margin-left: auto; font-size: 9px; color: var(--muted, #9ca3af); background: #1f2937; padding: 1px 5px; border-radius: 2px; }

    .fields-section { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 10px; }
    .fields-header { display: flex; align-items: center; gap: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; margin-bottom: 8px; }
    .count-pill { background: #1e3a5f; color: #93c5fd; padding: 0 7px; border-radius: 10px; font-size: 9px; }

    .fields-table { display: flex; flex-direction: column; gap: 2px; overflow-x: auto; }
    .ft-row { display: grid; grid-template-columns: 1fr 1fr 0.8fr 0.4fr 0.4fr 0.4fr 1.5fr 1.5fr 70px; gap: 3px; align-items: center; padding: 4px; }
    .ft-row.header { font-size: 9px; text-transform: uppercase; letter-spacing: 0.2px; color: var(--muted, #6b7280); font-weight: 600; background: #1f2937; border-radius: 2px; padding: 6px 4px; }
    .ft-row.pk { background: #1e3a5f1a; border-left: 2px solid #8b5cf6; }
    .ft-row input[type=text], .ft-row select { padding: 3px 5px; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 2px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .ft-row input[type=checkbox] { width: 14px; height: 14px; justify-self: center; }
    .ft-actions { display: flex; gap: 2px; }

    .schema-preview { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 10px; }
    .sp-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; margin-bottom: 6px; }
    .sp-code { margin: 0; padding: 10px; background: #0b1120; border-radius: 3px; font-size: 11px; color: #d1d5db; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; overflow-x: auto; }

    .usage-section { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 10px; }
    .usage-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; margin-bottom: 6px; }
    .usage-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: #0b1120; border-radius: 3px; font-size: 11px; margin-bottom: 2px; }
    .usage-kind { font-size: 9px; color: var(--muted, #9ca3af); background: #1f2937; padding: 1px 5px; border-radius: 2px; text-transform: uppercase; font-weight: 600; min-width: 30px; text-align: center; }
    .usage-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #93c5fd; }
    .usage-ctx { color: var(--muted, #6b7280); font-size: 10px; }
    .usage-empty { font-size: 11px; color: var(--muted, #6b7280); font-style: italic; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; }
    .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 101; background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-radius: 6px; width: 440px; max-width: calc(100vw - 40px); display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border, #1f2937); }
    .modal-header h3 { margin: 0; font-size: 14px; color: var(--fg, #e5e7eb); font-weight: 600; }
    .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border, #1f2937); }
    .field { display: flex; flex-direction: column; gap: 3px; }
    .field-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; }
    .field input { padding: 5px 8px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 2px; font-size: 12px; font-family: inherit; }
    .error-box { padding: 8px 10px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 3px; font-size: 11px; }

    .detail-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted, #9ca3af); padding: 40px; text-align: center; }
    .empty-icon { font-size: 48px; opacity: 0.4; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--fg, #e5e7eb); }
    .empty-desc { font-size: 13px; max-width: 420px; line-height: 1.5; }
  `],
})
export class ModelDesignerComponent {
  readonly modelStore = inject(DraftModelStoreService);

  readonly propTypes: ReadonlyArray<PropertyType> = ['string', 'number', 'boolean', 'object', 'array', 'date', 'any'];

  readonly filter = signal<string>('');
  readonly selectedId = signal<string | null>(null);
  readonly createOpen = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly newId = signal('');
  readonly newTitle = signal('');
  readonly newDesc = signal('');

  readonly filteredModels = computed<ReadonlyArray<DraftModel>>(() => {
    const q = this.filter().trim().toLowerCase();
    const all = this.modelStore.all();
    if (!q) return all;
    return all.filter((m) => m.id.toLowerCase().includes(q) || m.title.toLowerCase().includes(q));
  });

  readonly totalFields = computed<number>(() =>
    this.modelStore.all().reduce((sum, m) => sum + m.fields.length, 0));

  readonly selectedModel = computed<DraftModel | null>(() => {
    const id = this.selectedId();
    return id ? this.modelStore.get(id) : null;
  });

  readonly relations = computed<ReadonlyArray<{ direction: 'outgoing' | 'incoming'; modelId: string; fieldId: string; kind: string; sourceModelId?: string }>>(() => {
    const model = this.selectedModel();
    if (!model) return [];
    const out: Array<{ direction: 'outgoing' | 'incoming'; modelId: string; fieldId: string; kind: string; sourceModelId?: string }> = [];
    for (const f of model.fields) {
      if (f.ref) out.push({ direction: 'outgoing', modelId: f.ref.modelId, fieldId: f.id, kind: f.ref.kind });
    }
    for (const ref of this.modelStore.findReferencingModels(model.id)) {
      out.push({ direction: 'incoming', modelId: model.id, fieldId: ref.field.id, kind: ref.field.ref!.kind, sourceModelId: ref.model.id });
    }
    return out;
  });

  readonly tsPreview = computed<string>(() => {
    const model = this.selectedModel();
    if (!model) return '';
    const lines = [`interface ${model.id} {`];
    for (const f of model.fields) {
      const opt = f.required ? '' : '?';
      let type: string = f.type;
      if (f.enumValues && f.enumValues.length > 0) type = f.enumValues.map((v) => `'${v}'`).join(' | ');
      else if (f.ref) type = f.ref.kind === '1:N' || f.ref.kind === 'N:M' ? `${f.ref.modelId}[]` : f.ref.modelId;
      const desc = f.description ? `  // ${f.description}` : '';
      const pk = f.primaryKey ? ' (PK)' : '';
      lines.push(`  ${f.id}${opt}: ${type};${pk}${desc}`);
    }
    lines.push('}');
    return lines.join('\n');
  });

  readonly usedBy = computed<ReadonlyArray<{ kind: string; id: string; context: string }>>(() => {
    // TODO: skanuj DraftDatasourceStore i DraftFormStore pod kątem referencji do tego modelu
    return [];
  });

  select(id: string): void { this.selectedId.set(id); }

  openCreateDialog(): void {
    this.newId.set(''); this.newTitle.set(''); this.newDesc.set('');
    this.createError.set(null); this.createOpen.set(true);
  }

  closeCreateDialog(): void { this.createOpen.set(false); }

  createModel(): void {
    const id = this.newId().trim();
    const title = this.newTitle().trim();
    if (!id) { this.createError.set('Podaj ID'); return; }
    if (!title) { this.createError.set('Podaj nazwę'); return; }
    if (this.modelStore.get(id)) { this.createError.set(`Model "${id}" już istnieje`); return; }
    this.modelStore.upsert({ id, title, description: this.newDesc().trim() || undefined, fields: [] });
    this.closeCreateDialog();
    this.selectedId.set(id);
  }

  deleteModel(id: string): void {
    if (typeof window !== 'undefined' && !window.confirm(`Usunąć model "${id}"?`)) return;
    this.modelStore.remove(id);
    if (this.selectedId() === id) this.selectedId.set(null);
  }

  addField(): void {
    const model = this.selectedModel();
    if (!model) return;
    const fields = [...model.fields];
    let n = fields.length + 1;
    while (fields.some((f) => f.id === `field${n}`)) n++;
    fields.push({ id: `field${n}`, type: 'string' });
    this.modelStore.updateFields(model.id, fields);
  }

  removeField(i: number): void {
    const model = this.selectedModel();
    if (!model) return;
    const fields = [...model.fields];
    fields.splice(i, 1);
    this.modelStore.updateFields(model.id, fields);
  }

  moveField(i: number, delta: number): void {
    const model = this.selectedModel();
    if (!model) return;
    const fields = [...model.fields];
    const t = i + delta;
    if (t < 0 || t >= fields.length) return;
    const [moved] = fields.splice(i, 1);
    fields.splice(t, 0, moved);
    this.modelStore.updateFields(model.id, fields);
  }

  updateFieldProp(i: number, key: string, value: unknown): void {
    const model = this.selectedModel();
    if (!model) return;
    const fields = [...model.fields];
    const f = { ...fields[i], [key]: value === '' ? undefined : value } as ModelField;
    fields[i] = f;
    this.modelStore.updateFields(model.id, fields);
  }

  fieldExtra(f: ModelField): string {
    if (f.enumValues && f.enumValues.length > 0) return f.enumValues.join(', ');
    if (f.ref) return `→ ${f.ref.modelId} (${f.ref.kind})`;
    return '';
  }

  fieldExtraPlaceholder(f: ModelField): string {
    if (f.type === 'string') return 'enum: val1, val2 lub → ModelId (1:N)';
    return '→ ModelId (1:N)';
  }

  updateFieldExtra(i: number, f: ModelField, value: string): void {
    const model = this.selectedModel();
    if (!model) return;
    const fields = [...model.fields];
    if (value.startsWith('→') || value.includes('(1:')) {
      const match = value.match(/→?\s*(\w+)\s*\((\S+)\)/);
      if (match) {
        fields[i] = { ...f, ref: { modelId: match[1], kind: match[2] as ModelRelation['kind'] }, enumValues: undefined };
      }
    } else if (value.includes(',')) {
      fields[i] = { ...f, enumValues: value.split(',').map((v) => v.trim()).filter(Boolean), ref: undefined };
    } else if (value === '') {
      fields[i] = { ...f, enumValues: undefined, ref: undefined };
    }
    this.modelStore.updateFields(model.id, fields);
  }
}
