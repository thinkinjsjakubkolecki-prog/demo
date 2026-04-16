/**
 * fx-flow-diagram — interaktywny renderer FlowGraph (BPMN-like) dla stron Echelon.
 *
 * Demo Process Designera v0.2 rc.15:
 *  - dropdown ze stronami (z `PAGE_REGISTRY`),
 *  - przycisk LR/TD przełącza orientację,
 *  - live mermaid render (via window.mermaid z CDN — patrz index.html),
 *  - source tekstu mermaid w <pre> obok.
 */
import { signal, effect, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { buildFlowGraph, toMermaid } from '@echelon-framework/designer-core';
import type { FlowGraph } from '@echelon-framework/designer-core';
import type { PageConfig } from '@echelon-framework/core';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';

interface PageEntry {
  readonly id: string;
  readonly title: string;
  readonly config: PageConfig;
}

declare global {
  interface Window {
    mermaid?: { render: (id: string, text: string) => Promise<{ svg: string }>; initialize: (opts: unknown) => void };
  }
}

@EchelonWidget({
  manifest: {
    type: 'flow-diagram',
    version: '0.1.0',
    category: 'designer',
    description: 'Live FlowGraph renderer — wybierz stronę, zobacz mermaid diagram (BPMN-like).',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: [], lifecycleGates: ['ready'] },
  },
  selector: 'fx-flow-diagram',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="toolbar">
      <label>
        <span>Strona:</span>
        <select [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)">
          @for (p of pages; track p.id) {
            <option [value]="p.id">{{ p.title }} ({{ p.id }})</option>
          }
        </select>
      </label>
      <label>
        <span>Kierunek:</span>
        <select [ngModel]="direction()" (ngModelChange)="direction.set($event)">
          <option value="LR">Poziomo (Left → Right)</option>
          <option value="TD">Pionowo (Top → Down)</option>
          <option value="BT">Pionowo (Bottom → Top)</option>
          <option value="RL">Poziomo (Right → Left)</option>
        </select>
      </label>
      <button type="button" (click)="copyMermaid()">📋 Kopiuj mermaid</button>
      <a href="https://mermaid.live" target="_blank" rel="noopener">↗ mermaid.live</a>
    </div>

    <div class="stats">
      <span><strong>{{ graph()?.pageId }}</strong></span>
      <span>• {{ graph()?.nodes?.length ?? 0 }} nodów</span>
      <span>• {{ graph()?.edges?.length ?? 0 }} krawędzi</span>
    </div>

    <div class="content">
      <div class="diagram">
        <div class="diagram-inner" #diagramHost [innerHTML]="svg()"></div>
        @if (!mermaidReady()) {
          <div class="loading">⏳ Ładowanie mermaid.js z CDN…</div>
        }
      </div>
      <details class="source">
        <summary>Mermaid source ({{ mermaidCode().length }} znaków)</summary>
        <pre>{{ mermaidCode() }}</pre>
      </details>
      <details class="source">
        <summary>FlowGraph JSON (model domenowy)</summary>
        <pre>{{ graphJson() }}</pre>
      </details>
    </div>

    <div class="legend">
      <span class="chip datasource">Datasource</span>
      <span class="chip widget">Widget</span>
      <span class="chip computed">Computed</span>
      <span class="chip handler">Handler</span>
      <span class="chip lifecycle">Lifecycle</span>
      <span class="legend-note">→ bind · ==⇒ emit · ⋯→ computed-dep</span>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--panel, #0f172a); color: var(--fg, #e5e7eb); min-height: 100%; border-radius: 6px; }
    .toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid var(--border, #1f2937); }
    .toolbar label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .toolbar label span { color: var(--muted, #9ca3af); }
    .toolbar select, .toolbar button { padding: 6px 10px; border: 1px solid var(--border, #374151); background: var(--panel-alt, #1f2937); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 13px; cursor: pointer; }
    .toolbar a { color: var(--accent, #58a6ff); font-size: 13px; text-decoration: none; margin-left: auto; }
    .stats { display: flex; gap: 10px; font-size: 13px; color: var(--muted, #9ca3af); padding: 4px 0; }
    .stats strong { color: var(--accent, #58a6ff); }
    .content { display: flex; flex-direction: column; gap: 12px; }
    .diagram { position: relative; background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 16px; min-height: 300px; overflow: auto; }
    .diagram-inner :global(svg) { max-width: 100%; height: auto; }
    .loading { color: var(--muted, #9ca3af); text-align: center; padding: 40px 0; font-style: italic; }
    .source { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 10px 14px; }
    .source summary { cursor: pointer; font-size: 13px; color: var(--muted, #9ca3af); user-select: none; }
    .source summary:hover { color: var(--fg, #e5e7eb); }
    .source pre { margin: 8px 0 0; padding: 12px; background: #0b1120; border-radius: 4px; font-size: 11px; overflow-x: auto; color: #d1d5db; white-space: pre-wrap; word-break: break-all; }
    .legend { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 11px; color: var(--muted, #9ca3af); padding-top: 8px; border-top: 1px dashed var(--border, #1f2937); }
    .chip { padding: 2px 8px; border-radius: 10px; font-weight: 500; font-size: 10px; }
    .chip.datasource { background: #1e3a5f; color: #e0f2fe; }
    .chip.widget { background: #374151; color: #f3f4f6; }
    .chip.computed { background: #713f12; color: #fef3c7; }
    .chip.handler { background: #5b21b6; color: #ede9fe; }
    .chip.lifecycle { background: #064e3b; color: #d1fae5; }
    .legend-note { margin-left: 8px; font-family: monospace; font-size: 10px; }
  `],
})
export class FlowDiagramComponent implements AfterViewInit {
  readonly pages: PageEntry[];
  readonly selectedId = signal<string>('');
  readonly direction = signal<'LR' | 'TD' | 'BT' | 'RL'>('LR');
  readonly mermaidReady = signal<boolean>(typeof window !== 'undefined' && !!window.mermaid);
  readonly svg = signal<string>('');
  @ViewChild('diagramHost', { static: false }) host?: ElementRef<HTMLElement>;

  constructor() {
    this.pages = this.collectPages();
    if (this.pages.length > 0) this.selectedId.set(this.pages[0]!.id);

    if (typeof window !== 'undefined' && !this.mermaidReady()) {
      window.addEventListener('mermaid-ready', () => this.mermaidReady.set(true), { once: true });
    }

    effect(() => {
      const code = this.mermaidCode();
      const ready = this.mermaidReady();
      if (!ready || !code) return;
      this.renderMermaid(code);
    });
  }

  ngAfterViewInit(): void {
    if (this.mermaidReady()) this.renderMermaid(this.mermaidCode());
  }

  graph(): FlowGraph | null {
    const entry = this.pages.find((p) => p.id === this.selectedId());
    return entry ? buildFlowGraph(entry.config) : null;
  }

  mermaidCode(): string {
    const g = this.graph();
    return g ? toMermaid(g, { direction: this.direction(), includeSubtitle: true }) : '';
  }

  graphJson(): string {
    const g = this.graph();
    return g ? JSON.stringify({ pageId: g.pageId, title: g.title, nodes: g.nodes, edges: g.edges }, null, 2) : '';
  }

  copyMermaid(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(this.mermaidCode());
    }
  }

  private async renderMermaid(code: string): Promise<void> {
    const mermaid = window.mermaid;
    if (!mermaid) return;
    try {
      const id = `mermaid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { svg } = await mermaid.render(id, code);
      this.svg.set(svg);
    } catch (err) {
      this.svg.set(`<div style="color:#ef4444;padding:16px;">Mermaid render failed: ${(err as Error).message}</div>`);
    }
  }

  private collectPages(): PageEntry[] {
    const classes = getRegisteredPageClasses() as Array<{ config?: PageConfig; name?: string }>;
    const out: PageEntry[] = [];
    for (const cls of classes) {
      const cfg = cls?.config;
      if (!cfg?.page?.id) continue;
      out.push({
        id: cfg.page.id,
        title: cfg.page.title ?? cfg.page.id,
        config: cfg,
      });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }
}
