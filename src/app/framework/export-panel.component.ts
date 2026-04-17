/**
 * fx-export-panel — eksportuje wszystkie drafty do JSON bundle lub TypeScript.
 *
 * Dostępny jako widget na stronie lub jako standalone panel.
 * DEV → edycja w designerach → Export → PROD (statyczny kompilat).
 */
import { inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EchelonWidget } from '@echelon-framework/runtime';
import { DraftModelStoreService } from './draft-model-store';
import { DraftFormStoreService } from './draft-form-store';
import { DraftDatasourceStoreService } from './draft-datasource-store';
import { DraftPageStoreService } from './draft-page-store';
import { exportBundle, exportBundleAsJson, exportBundleAsTypeScript, type ExportBundle } from './export-bundle';

@EchelonWidget({
  manifest: {
    type: 'export-panel',
    version: '1.0.0',
    category: 'designer',
    description: 'Export designerskich draftów do JSON bundle lub TypeScript source.',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: {},
    testability: { interactions: [], observables: ['export-panel'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-export-panel',
  imports: [CommonModule],
  template: `
    <div class="wrap" data-testid="export-panel" data-echelon-state="ready">
      <div class="header">
        <h2>📤 Export Designer Bundle</h2>
        <p class="desc">
          Eksportuj wszystkie drafty (modele, formularze, datasources, strony) do
          formatu produkcyjnego. JSON bundle ładujesz w runtime. TypeScript wrzucasz
          do repo i budujesz statycznie.
        </p>
      </div>

      <div class="stats">
        <div class="stat"><span class="stat-num">{{ modelCount() }}</span><span class="stat-label">Modeli</span></div>
        <div class="stat"><span class="stat-num">{{ formCount() }}</span><span class="stat-label">Formularzy</span></div>
        <div class="stat"><span class="stat-num">{{ dsCount() }}</span><span class="stat-label">DataSources</span></div>
        <div class="stat"><span class="stat-num">{{ pageCount() }}</span><span class="stat-label">Stron</span></div>
      </div>

      <div class="actions">
        <button type="button" class="btn-export json" (click)="exportJson()">
          📋 Export JSON Bundle
        </button>
        <button type="button" class="btn-export ts" (click)="exportTs()">
          📝 Export TypeScript
        </button>
        <button type="button" class="btn-export file" (click)="downloadJson()">
          💾 Pobierz JSON (plik)
        </button>
      </div>

      @if (exportedContent()) {
        <div class="output">
          <div class="output-header">
            <span>{{ exportFormat() === 'json' ? 'JSON Bundle' : 'TypeScript Source' }}</span>
            <button type="button" class="btn-copy" (click)="copyToClipboard()">
              {{ copied() ? '✓ Skopiowano' : '📋 Kopiuj' }}
            </button>
          </div>
          <pre class="output-code">{{ exportedContent() }}</pre>
        </div>
      }

      @if (totalCount() === 0) {
        <div class="empty">
          Brak draftów do eksportu. Stwórz modele, formularze, datasources
          lub strony w designerach, a potem wróć tutaj żeby wyeksportować.
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; padding: 16px; color: var(--fg, #e5e7eb); }
    .wrap { background: var(--panel, #0f172a); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 20px; }
    .header h2 { margin: 0 0 8px; font-size: 16px; font-weight: 700; color: var(--accent, #58a6ff); }
    .desc { margin: 0 0 16px; font-size: 12px; color: var(--muted, #9ca3af); line-height: 1.5; }

    .stats { display: flex; gap: 16px; margin-bottom: 20px; }
    .stat { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 12px 20px; text-align: center; flex: 1; }
    .stat-num { display: block; font-size: 24px; font-weight: 700; color: var(--fg, #e5e7eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); }

    .actions { display: flex; gap: 10px; margin-bottom: 16px; }
    .btn-export { padding: 10px 20px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid; }
    .btn-export.json { background: #1e3a5f; border-color: #3b82f6; color: #e0f2fe; }
    .btn-export.json:hover { background: #1e40af; }
    .btn-export.ts { background: #064e3b; border-color: #10b981; color: #d1fae5; }
    .btn-export.ts:hover { background: #065f46; }
    .btn-export.file { background: #78350f; border-color: #f59e0b; color: #fef3c7; }
    .btn-export.file:hover { background: #92400e; }

    .output { margin-top: 16px; }
    .output-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #1f2937; border-radius: 4px 4px 0 0; font-size: 11px; color: var(--muted, #9ca3af); font-weight: 600; text-transform: uppercase; }
    .btn-copy { padding: 4px 12px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 2px; font-size: 11px; cursor: pointer; font-family: inherit; }
    .output-code { margin: 0; padding: 16px; background: #0b1120; border: 1px solid var(--border, #1f2937); border-top: none; border-radius: 0 0 4px 4px; font-size: 11px; color: #d1d5db; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; overflow: auto; max-height: 500px; }

    .empty { padding: 30px; text-align: center; color: var(--muted, #6b7280); font-size: 13px; font-style: italic; border: 1px dashed var(--border, #374151); border-radius: 4px; }
  `],
})
export class ExportPanelComponent {
  private readonly modelStore = inject(DraftModelStoreService);
  private readonly formStore = inject(DraftFormStoreService);
  private readonly dsStore = inject(DraftDatasourceStoreService);
  private readonly pageStore = inject(DraftPageStoreService);

  readonly exportedContent = signal<string | null>(null);
  readonly exportFormat = signal<'json' | 'ts'>('json');
  readonly copied = signal(false);

  readonly modelCount = computed(() => this.modelStore.all().length);
  readonly formCount = computed(() => this.formStore.all().length);
  readonly dsCount = computed(() => this.dsStore.all().length);
  readonly pageCount = computed(() => this.pageStore.all().length);
  readonly totalCount = computed(() => this.modelCount() + this.formCount() + this.dsCount() + this.pageCount());

  private buildBundle(): ExportBundle {
    return exportBundle(this.modelStore, this.formStore, this.dsStore, this.pageStore);
  }

  exportJson(): void {
    this.exportFormat.set('json');
    this.exportedContent.set(exportBundleAsJson(this.buildBundle()));
    this.copied.set(false);
  }

  exportTs(): void {
    this.exportFormat.set('ts');
    this.exportedContent.set(exportBundleAsTypeScript(this.buildBundle()));
    this.copied.set(false);
  }

  downloadJson(): void {
    const json = exportBundleAsJson(this.buildBundle());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echelon-designer-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyToClipboard(): void {
    const content = this.exportedContent();
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
