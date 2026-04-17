/**
 * fx-process-summary — renderuje dowolny obiekt jako tabelkę key/value.
 *
 * Przyjmuje `data` (bind do flat object np. $ds.txDraft) i automatycznie
 * konwertuje na listę par klucz → wartość. Używany w review stepach wizardów.
 */
import { Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EchelonWidget } from '@echelon-framework/runtime';

@EchelonWidget({
  manifest: {
    type: 'process-summary',
    version: '0.1.0',
    category: 'data',
    description: 'Renderuje flat object jako tabelkę key/value (review step wizarda).',
    inputs: [
      { name: 'data', type: 'object', required: true },
      { name: 'title', type: 'string' },
    ],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: ['data'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-process-summary',
  imports: [CommonModule],
  template: `
    <div class="summary" data-testid="widget-process-summary" data-echelon-state="ready">
      @if (title) { <div class="sum-title">{{ title }}</div> }
      @if (rows().length === 0) {
        <div class="sum-empty">Brak danych do wyświetlenia</div>
      } @else {
        <dl class="sum-grid">
          @for (r of rows(); track r.key) {
            <dt>{{ r.key }}</dt>
            <dd>{{ r.display }}</dd>
          }
        </dl>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .summary { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 16px; }
    .sum-title { font-size: 14px; font-weight: 600; color: var(--fg, #e5e7eb); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border, #1f2937); }
    .sum-empty { color: var(--muted, #9ca3af); font-size: 12px; font-style: italic; padding: 20px 0; text-align: center; }
    .sum-grid { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 8px 20px; }
    dt { color: var(--muted, #9ca3af); font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; align-self: center; margin: 0; white-space: nowrap; font-weight: 600; }
    dd { color: var(--fg, #e5e7eb); margin: 0; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
  `],
})
export class ProcessSummaryComponent {
  @Input() title?: string;
  @Input() set data(v: unknown) {
    this._data.set(v);
  }
  private readonly _data = signal<unknown>(undefined);

  readonly rows = computed<ReadonlyArray<{ key: string; display: string }>>(() => {
    const d = this._data();
    if (!d || typeof d !== 'object' || Array.isArray(d)) return [];
    return Object.entries(d as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => ({
        key: k,
        display: typeof v === 'object' ? JSON.stringify(v) : String(v),
      }));
  });
}
