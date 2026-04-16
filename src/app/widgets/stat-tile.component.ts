import { Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EchelonWidget } from '@echelon-framework/runtime';

@EchelonWidget({
  manifest: {
    type: 'stat-tile',
    version: '1.0.0',
    category: 'data',
    description: 'Pojedyncza wartość liczbowa/tekstowa z labelem (KPI tile).',
    inputs: [
      { name: 'label', type: 'string', required: true },
      { name: 'value', type: 'string' },
      { name: 'tone', type: 'string' },
    ],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: ['value'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-stat-tile',
  imports: [CommonModule],
  template: `
    <div class="tile" [attr.data-tone]="tone || 'neutral'"
         data-testid="widget-stat-tile" data-echelon-state="ready">
      <div class="label">{{ label }}</div>
      <div class="value">{{ value || '—' }}</div>
    </div>
  `,
  styles: [`
    .tile {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 8px; padding: 14px 16px;
    }
    .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .value { font-size: 20px; font-weight: 600; font-family: ui-monospace, monospace; }
    .tile[data-tone="profit"] .value { color: var(--buy); }
    .tile[data-tone="loss"]   .value { color: var(--sell); }
    .tile[data-tone="accent"] .value { color: var(--accent); }
  `],
})
export class StatTileComponent {
  @Input() label = '';
  @Input() value: string | number | null = null;
  @Input() tone: 'neutral' | 'profit' | 'loss' | 'accent' = 'neutral';
}
