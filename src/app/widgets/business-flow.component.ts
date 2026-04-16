/**
 * fx-business-flow — renderer realnych biznesowych procesów z linkami do kodu.
 *
 * Pokazuje:
 *  - swim-lane BPMN diagram (mermaid flowchart + subgraphs per lane),
 *  - legendę statusów (✓ implemented / ⚠ partial / ✗ todo),
 *  - tabelę kroków z mappingiem na kod (widget/handler/plik),
 *  - instrukcją "co kliknąć w GUI" dla każdego kroku,
 *  - link "Otwórz w aplikacji" → navigate do rzeczywistej strony,
 *  - klikalne kroki: wybór → rozwinięty panel szczegółów.
 */
import { signal, effect, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EchelonWidget } from '@echelon-framework/runtime';
import { businessProcesses } from '../processes';
import type { BusinessProcess, ProcessStep, StepStatus } from '../processes';

declare global {
  interface Window {
    mermaid?: { render: (id: string, text: string) => Promise<{ svg: string }>; initialize: (opts: unknown) => void };
  }
}

@EchelonWidget({
  manifest: {
    type: 'business-flow',
    version: '0.1.0',
    category: 'designer',
    description: 'BPMN-like renderer dla realnych biznesowych procesów dealer-fx-app (RFQ, Position Close).',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: [], lifecycleGates: ['ready'] },
  },
  selector: 'fx-business-flow',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="toolbar">
      <label>
        <span>Proces:</span>
        <select [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)">
          @for (p of processes; track p.id) {
            <option [value]="p.id">{{ p.title }}</option>
          }
        </select>
      </label>
      @if (process(); as p) {
        @if (p.entryRoute) {
          <button type="button" class="primary" (click)="openRoute(p.entryRoute)">↗ Otwórz stronę {{ p.entryRoute }}</button>
        }
        <div class="counters">
          <span class="counter implemented">✓ {{ statusCount('implemented') }} zrobione</span>
          <span class="counter partial">⚠ {{ statusCount('partial') }} częściowe</span>
          <span class="counter todo">✗ {{ statusCount('todo') }} TODO</span>
        </div>
      }
    </div>

    @if (process(); as p) {
      <div class="description">{{ p.description }}</div>

      <div class="diagram" [innerHTML]="svg()"></div>
      @if (!mermaidReady()) {
        <div class="loading">⏳ Ładowanie mermaid z CDN…</div>
      }

      <h3>Kroki + mapowanie na kod</h3>
      <ol class="steps">
        @for (s of p.steps; track s.id) {
          <li class="step" [class.selected]="selectedStep() === s.id"
              [class.implemented]="s.status === 'implemented'"
              [class.partial]="s.status === 'partial'"
              [class.todo]="s.status === 'todo'"
              (click)="selectedStep.set(selectedStep() === s.id ? null : s.id)">
            <div class="step-header">
              <span class="icon">{{ statusIcon(s.status) }}</span>
              <span class="lane-badge" [style.background]="laneColor(p, s.lane)">{{ laneLabel(p, s.lane) }}</span>
              <span class="label">{{ s.label }}</span>
            </div>
            @if (selectedStep() === s.id) {
              <div class="step-body">
                <p class="desc">{{ s.description }}</p>
                @if (s.howToSee) {
                  <div class="how-to-see">
                    <strong>🖱 Jak zobaczyć:</strong>
                    <span>{{ s.howToSee }}</span>
                  </div>
                }
                <div class="impl">
                  <strong>🔧 Mapowanie w kodzie:</strong>
                  <dl>
                    @if (s.impl.page) { <dt>page</dt><dd>{{ s.impl.page }}</dd> }
                    @if (s.impl.route) { <dt>route</dt><dd><a (click)="openRoute(s.impl.route)">{{ s.impl.route }}</a></dd> }
                    @if (s.impl.widget) { <dt>widget</dt><dd><code>{{ s.impl.widget }}</code></dd> }
                    @if (s.impl.event) { <dt>event</dt><dd><code>{{ s.impl.event }}</code></dd> }
                    @if (s.impl.handler) { <dt>handler</dt><dd><code>{{ s.impl.handler }}</code></dd> }
                    @if (s.impl.datasource) { <dt>datasource</dt><dd><code>{{ s.impl.datasource }}</code></dd> }
                    @if (s.impl.computed) { <dt>computed</dt><dd><code>{{ s.impl.computed }}</code></dd> }
                    @if (s.impl.file) { <dt>plik</dt><dd><code>{{ s.impl.file }}</code></dd> }
                    @if (s.impl.note) { <dt>note</dt><dd class="note">{{ s.impl.note }}</dd> }
                  </dl>
                </div>
              </div>
            }
          </li>
        }
      </ol>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 14px; padding: 16px; background: var(--panel, #0f172a); color: var(--fg, #e5e7eb); border-radius: 6px; }
    .toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1px solid var(--border, #1f2937); }
    .toolbar label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .toolbar label span { color: var(--muted, #9ca3af); }
    .toolbar select { padding: 6px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 13px; }
    .toolbar button { padding: 6px 12px; border: 1px solid var(--border, #374151); background: var(--panel-alt, #1f2937); color: var(--fg, #e5e7eb); border-radius: 4px; cursor: pointer; font-size: 13px; }
    .toolbar button.primary { background: #1e3a5f; border-color: #3b82f6; color: #e0f2fe; }
    .toolbar button:hover { border-color: #58a6ff; }
    .counters { display: flex; gap: 8px; margin-left: auto; font-size: 12px; }
    .counter { padding: 3px 10px; border-radius: 10px; font-weight: 500; }
    .counter.implemented { background: #064e3b; color: #d1fae5; }
    .counter.partial { background: #713f12; color: #fef3c7; }
    .counter.todo { background: #7f1d1d; color: #fee2e2; }

    .description { color: var(--muted, #9ca3af); font-size: 13px; font-style: italic; line-height: 1.5; }

    .diagram { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 16px; overflow: auto; min-height: 200px; }
    .diagram :global(svg) { max-width: 100%; height: auto; }
    .loading { color: var(--muted, #9ca3af); text-align: center; padding: 40px 0; font-style: italic; }

    h3 { margin: 4px 0; font-size: 14px; color: var(--accent, #58a6ff); font-weight: 600; }
    .steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .step { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-left-width: 4px; border-radius: 4px; cursor: pointer; transition: border-color 0.15s; }
    .step.implemented { border-left-color: #10b981; }
    .step.partial { border-left-color: #f59e0b; }
    .step.todo { border-left-color: #ef4444; }
    .step:hover { background: #1a2332; }
    .step.selected { background: #1a2332; border-color: var(--accent, #58a6ff); }
    .step-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
    .icon { font-size: 14px; width: 16px; text-align: center; }
    .lane-badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; opacity: 0.9; }
    .label { font-size: 13px; font-weight: 500; }
    .step-body { padding: 0 16px 14px 38px; display: flex; flex-direction: column; gap: 10px; border-top: 1px dashed #1f2937; margin-top: 4px; padding-top: 12px; }
    .desc { margin: 0; font-size: 13px; line-height: 1.55; color: #d1d5db; }
    .how-to-see { padding: 8px 12px; background: #1e3a5f33; border-left: 3px solid #3b82f6; font-size: 12px; color: #cbd5e1; border-radius: 2px; display: flex; gap: 8px; align-items: flex-start; }
    .impl { font-size: 12px; }
    .impl dl { display: grid; grid-template-columns: 100px 1fr; gap: 4px 12px; margin: 6px 0 0; }
    .impl dt { color: var(--muted, #9ca3af); font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; padding-top: 2px; }
    .impl dd { margin: 0; color: #e5e7eb; }
    .impl code { background: #0b1120; padding: 2px 6px; border-radius: 3px; font-size: 11px; color: #93c5fd; }
    .impl a { color: #60a5fa; cursor: pointer; text-decoration: underline; }
    .impl .note { color: #fcd34d; font-style: italic; font-size: 11px; }
  `],
})
export class BusinessFlowComponent {
  readonly processes = businessProcesses;
  readonly selectedId = signal<string>(this.processes[0]?.id ?? '');
  readonly selectedStep = signal<string | null>(null);
  readonly mermaidReady = signal<boolean>(typeof window !== 'undefined' && !!window.mermaid);
  readonly svg = signal<string>('');
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly process = computed<BusinessProcess | null>(() =>
    this.processes.find((p) => p.id === this.selectedId()) ?? null,
  );

  constructor() {
    if (typeof window !== 'undefined' && !this.mermaidReady()) {
      const handler = (): void => this.mermaidReady.set(true);
      window.addEventListener('mermaid-ready', handler, { once: true });
      this.destroyRef.onDestroy(() => window.removeEventListener('mermaid-ready', handler));
    }

    effect(() => {
      const p = this.process();
      const ready = this.mermaidReady();
      if (!p || !ready) return;
      this.renderMermaid(this.buildMermaid(p));
    });
  }

  statusCount(status: StepStatus): number {
    return this.process()?.steps.filter((s) => s.status === status).length ?? 0;
  }

  statusIcon(status: StepStatus): string {
    return status === 'implemented' ? '✓' : status === 'partial' ? '⚠' : '✗';
  }

  laneLabel(p: BusinessProcess, laneId: string): string {
    return p.lanes.find((l) => l.id === laneId)?.label ?? laneId;
  }
  laneColor(p: BusinessProcess, laneId: string): string {
    return p.lanes.find((l) => l.id === laneId)?.color ?? '#6b7280';
  }

  openRoute(route: string): void {
    if (this.router) void this.router.navigateByUrl(route);
    else if (typeof window !== 'undefined') window.location.href = route;
  }

  /**
   * Generator mermaid composed conservatively for v11.14:
   *  - wszystkie node'y jako prosty `id["label"]` (unikamy ([ ]) / {{ }} / >] —
   *    mermaid 11 bywa wrażliwy na zagnieżdżone nawiasy w niektórych themes),
   *  - subgraph id alfanumerycznie, label quoted,
   *  - edge label przez pipe syntax `-->|"label"|` (najbardziej stabilne),
   *  - kształt BPMN (gateway/start/end/event) koduje classDef (kolor/ramka),
   *    nie shape marker — ten sam efekt wizualny, mniej syntaktycznych pułapek.
   */
  private buildMermaid(p: BusinessProcess): string {
    const lines: string[] = ['flowchart LR'];
    for (const lane of p.lanes) {
      const laneSteps = p.steps.filter((s) => s.lane === lane.id);
      if (laneSteps.length === 0) continue;
      const laneId = `lane${lane.id.replace(/[^a-zA-Z0-9]/g, '')}`;
      lines.push(`  subgraph ${laneId}["${sanitize(lane.label)}"]`);
      lines.push('    direction TB');
      for (const s of laneSteps) {
        lines.push(`    ${s.id}["${sanitize(s.label)}"]`);
      }
      lines.push('  end');
    }
    for (const e of p.edges) {
      if (e.label) lines.push(`  ${e.from} -->|"${sanitize(e.label)}"| ${e.to}`);
      else lines.push(`  ${e.from} --> ${e.to}`);
    }
    const byStatus: Record<StepStatus, string[]> = { implemented: [], partial: [], todo: [] };
    for (const s of p.steps) byStatus[s.status].push(s.id);
    lines.push(`  classDef implemented fill:#064e3b,stroke:#10b981,color:#d1fae5`);
    lines.push(`  classDef partial fill:#713f12,stroke:#f59e0b,color:#fef3c7`);
    lines.push(`  classDef todo fill:#7f1d1d,stroke:#ef4444,color:#fee2e2`);
    for (const st of ['implemented', 'partial', 'todo'] as StepStatus[]) {
      if (byStatus[st].length) lines.push(`  class ${byStatus[st].join(',')} ${st}`);
    }
    return lines.join('\n');
  }

  private async renderMermaid(code: string): Promise<void> {
    const m = window.mermaid;
    if (!m) return;
    try {
      const id = `biz-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { svg } = await m.render(id, code);
      this.svg.set(svg);
    } catch (err) {
      this.svg.set(`<div style="color:#ef4444;padding:16px;">Mermaid render failed: ${(err as Error).message}</div>`);
    }
  }
}

/**
 * Mermaid 11.x jest mocno restrykcyjny dla label content w quoted stringach:
 *  - podwójny cudzysłów → pojedynczy,
 *  - | / { / } / [ / ] / ( / ) → spacje (psują shape markers),
 *  - HTML entities nie są dekodowane → usuwamy,
 *  - emoji → wypadają bezpiecznie, ale niektóre kombinacje są problematyczne.
 */
function sanitize(value: string): string {
  return value
    .replace(/"/g, "'")
    .replace(/[|{}[\]()]/g, ' ')
    .replace(/[<>&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
