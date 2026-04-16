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
import { signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';

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
          <div class="placeholder-inline">⏳ M2 — page picker</div>
        </header>
        <section class="canvas-area">
          <div class="placeholder">⏳ M3 — preview wybranej strony (read-only)</div>
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
  `],
})
export class DesignerShellComponent {
  /** Stan milestone — placeholder, zostanie zastąpiony przez dane w kolejnych krokach. */
  readonly milestoneLabel = signal<string>('M1 — szkielet');
}
