import { Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EchelonWidget } from '@echelon-framework/runtime';

@EchelonWidget({
  manifest: {
    type: 'page-title',
    version: '1.0.0',
    category: 'shell',
    description: 'Nagłówek strony — tytuł + opcjonalny podtytuł.',
    inputs: [
      { name: 'title', type: 'string', required: true },
      { name: 'subtitle', type: 'string' },
    ],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: [], lifecycleGates: ['ready'] },
  },
  selector: 'fx-page-title',
  imports: [CommonModule],
  template: `
    <header data-testid="widget-page-title" data-echelon-state="ready">
      <h1>{{ title }}</h1>
      @if (subtitle) { <p>{{ subtitle }}</p> }
    </header>
  `,
  styles: [`
    header { padding: 16px 0; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
    h1 { margin: 0; font-size: 20px; font-weight: 600; }
    p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  `],
})
export class PageTitleComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
