/**
 * fx-process-designer — dedykowana sekcja designera dla procesów (wizardów).
 *
 * Skanuje zarejestrowane procesy i strony typu process/* , pokazuje listę
 * procesów z ich krokami jako visual DAG (mermaid-based FlowDiagramComponent
 * reuse) + config preview.
 */
import { computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { getRegisteredPageClasses } from '@echelon-framework/page-builders';
import type { PageConfig } from '@echelon-framework/core';
import { DraftPageStoreService } from '../services/draft-page-store.service';

interface ProcessInfo {
  readonly id: string;
  readonly title: string;
  readonly steps: ReadonlyArray<StepInfo>;
  readonly entryRoute: string;
}

interface StepInfo {
  readonly stepId: string;
  readonly pageId: string;
  readonly title: string;
  readonly route: string;
  readonly hasForm: boolean;
  readonly hasCommit: boolean;
  readonly nextStepId: string | null;
}

function extractProcesses(): ReadonlyArray<ProcessInfo> {
  const classes = getRegisteredPageClasses() as Array<{ config?: PageConfig }>;
  const processPages = new Map<string, { step: string; config: PageConfig; route: string }[]>();

  for (const cls of classes) {
    const cfg = cls.config;
    if (!cfg) continue;
    const pageId = cfg.page.id;
    const match = pageId.match(/^([^-]+(?:-[^-]+)*?)-([^-]+)$/);
    if (!match) continue;

    const meta = (cls as Record<string, unknown>)['__echelonPageMeta'] as { route?: string } | undefined;
    const route = meta?.route ?? '';
    if (!route.startsWith('/process/')) continue;

    const parts = route.replace('/process/', '').split('/');
    const processId = parts[0] ?? pageId;
    const stepId = parts[1] ?? match[2];

    if (!processPages.has(processId)) processPages.set(processId, []);
    processPages.get(processId)!.push({ step: stepId, config: cfg, route });
  }

  const out: ProcessInfo[] = [];
  for (const [processId, steps] of processPages) {
    const stepInfos: StepInfo[] = steps.map((s) => {
      const handlers = s.config.page.eventHandlers ?? [];
      const hasForm = Object.values(s.config.page.widgets ?? {}).some(
        (w: unknown) => {
          const t = (w as { type?: string }).type ?? '';
          return t.includes('form');
        },
      );
      const hasCommit = handlers.some((h: unknown) => {
        const acts = ((h as unknown as { do?: unknown[] }).do ?? []) as Array<Record<string, unknown>>;
        return acts.some((a) => a['fetch'] !== undefined || (typeof a['emit'] === 'string' && String(a['emit']).includes('commit')));
      });

      let nextStepId: string | null = null;
      for (const h of handlers) {
        const acts = ((h as unknown as { do?: unknown[] }).do ?? []) as Array<Record<string, unknown>>;
        for (const a of acts) {
          const nav = a['navigate'];
          if (typeof nav === 'string' && nav.includes('/process/')) {
            const navParts = nav.replace('/process/', '').split('/');
            if (navParts[1]) nextStepId = navParts[1];
          }
        }
      }

      return {
        stepId: s.step,
        pageId: s.config.page.id,
        title: s.config.page.title ?? s.step,
        route: s.route,
        hasForm,
        hasCommit,
        nextStepId,
      };
    });

    out.push({
      id: processId,
      title: stepInfos[0]?.title?.replace(/ — .*/, '') ?? processId,
      steps: stepInfos,
      entryRoute: stepInfos[0]?.route ?? '',
    });
  }
  return out;
}

@EchelonWidget({
  manifest: {
    type: 'process-designer',
    version: '0.1.0',
    category: 'designer',
    description: 'Designer sekcja dla procesów (wizardów) — lista + DAG kroków.',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: {},
    testability: { interactions: [], observables: ['process-designer'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-process-designer',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" data-testid="process-designer" data-echelon-state="ready">
      <div class="toolbar">
        <h2>🔄 Process Designer</h2>
        <div class="meta">
          <span>{{ allProcesses().length }} procesów</span>
          <span class="sep">·</span>
          <span>{{ totalSteps() }} kroków łącznie</span>
        </div>
      </div>

      <div class="layout">
        <aside class="list">
          <div class="list-header">Procesy</div>
          @for (p of allProcesses(); track p.id) {
            <button type="button" class="proc-item"
                    [class.active]="selected()?.id === p.id"
                    (click)="select(p)">
              <div class="proc-line-1">
                <span class="proc-id">{{ p.id }}</span>
                <span class="proc-steps">{{ p.steps.length }} kroków</span>
              </div>
              <div class="proc-line-2">{{ p.title }}</div>
            </button>
          }
          @if (allProcesses().length === 0) {
            <div class="empty">
              Brak procesów — zarejestruj @Page z route /process/* lub użyj ProcessBuilder
            </div>
          }
        </aside>

        <main class="detail">
          @if (selected(); as proc) {
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ proc.id }}</div>
                <div class="detail-sub">{{ proc.steps.length }} kroków · entry: <code>{{ proc.entryRoute }}</code></div>
              </div>
              <a [href]="proc.entryRoute" target="_blank" class="btn-primary">▶ Uruchom</a>
            </div>

            <div class="dag">
              <div class="dag-header">DAG kroków</div>
              <div class="dag-flow">
                @for (step of proc.steps; track step.stepId; let i = $index) {
                  <div class="dag-node" [class.form]="step.hasForm" [class.commit]="step.hasCommit">
                    <div class="dag-step-id">{{ step.stepId }}</div>
                    <div class="dag-step-title">{{ step.title }}</div>
                    <div class="dag-step-tags">
                      @if (step.hasForm) { <span class="tag form">📋 form</span> }
                      @if (step.hasCommit) { <span class="tag commit">✓ commit</span> }
                    </div>
                    <div class="dag-step-route"><code>{{ step.route }}</code></div>
                  </div>
                  @if (step.nextStepId) {
                    <div class="dag-arrow">→</div>
                  }
                }
              </div>
            </div>

            <div class="steps-table">
              <div class="steps-header">
                <span>Step ID</span>
                <span>Tytuł</span>
                <span>Route</span>
                <span>Form</span>
                <span>Commit</span>
                <span>Next</span>
              </div>
              @for (step of proc.steps; track step.stepId) {
                <div class="steps-row">
                  <span class="cell-id">{{ step.stepId }}</span>
                  <span class="cell-title">{{ step.title }}</span>
                  <span class="cell-route"><code>{{ step.route }}</code></span>
                  <span class="cell-bool">{{ step.hasForm ? '✓' : '—' }}</span>
                  <span class="cell-bool">{{ step.hasCommit ? '✓' : '—' }}</span>
                  <span class="cell-next">{{ step.nextStepId ?? '(end)' }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="detail-empty">
              <div class="empty-icon">🔄</div>
              <div class="empty-title">Wybierz proces z listy</div>
              <div class="empty-desc">Zobacz DAG kroków, konfigurację i uruchom wizard.</div>
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

    .layout { display: grid; grid-template-columns: 300px 1fr; flex: 1; min-height: 0; }
    .list { background: var(--panel-alt, #111827); border-right: 1px solid var(--border, #1f2937); overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 3px; }
    .list-header { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); padding: 4px 8px 8px; font-weight: 600; }
    .empty { padding: 20px 10px; text-align: center; font-size: 12px; color: var(--muted, #9ca3af); font-style: italic; }

    .proc-item { background: var(--panel, #0f172a); border: 1px solid var(--border, #374151); border-left: 3px solid #10b981; border-radius: 3px; padding: 8px 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 3px; color: var(--fg, #e5e7eb); font-family: inherit; }
    .proc-item:hover { border-color: #58a6ff66; }
    .proc-item.active { background: #1e3a5f33; border-color: #58a6ff; border-left-color: #10b981; }
    .proc-line-1 { display: flex; align-items: center; gap: 6px; }
    .proc-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 600; color: #6ee7b7; flex: 1; }
    .proc-steps { font-size: 10px; color: var(--muted, #9ca3af); background: #1f2937; padding: 1px 6px; border-radius: 2px; }
    .proc-line-2 { font-size: 11px; color: var(--muted, #6b7280); }

    .detail { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border, #1f2937); }
    .detail-title { font-size: 20px; font-weight: 700; color: var(--fg, #e5e7eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .detail-sub { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 2px; }
    .detail-sub code { background: #1f2937; padding: 1px 6px; border-radius: 2px; color: #93c5fd; }
    .btn-primary { padding: 8px 16px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 3px; font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; }
    .btn-primary:hover { background: #065f46; }

    .dag { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; padding: 16px; }
    .dag-header { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #9ca3af); font-weight: 600; margin-bottom: 12px; }
    .dag-flow { display: flex; align-items: center; gap: 0; overflow-x: auto; padding: 8px 0; }
    .dag-node { background: var(--panel, #0f172a); border: 2px solid var(--border, #374151); border-radius: 6px; padding: 12px 16px; min-width: 180px; display: flex; flex-direction: column; gap: 4px; }
    .dag-node.form { border-color: #3b82f6; }
    .dag-node.commit { border-color: #10b981; background: #064e3b1a; }
    .dag-step-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 700; color: #93c5fd; }
    .dag-step-title { font-size: 11px; color: var(--fg, #e5e7eb); }
    .dag-step-tags { display: flex; gap: 4px; }
    .tag { font-size: 9px; padding: 1px 5px; border-radius: 2px; }
    .tag.form { background: #1e3a5f; color: #93c5fd; }
    .tag.commit { background: #064e3b; color: #6ee7b7; }
    .dag-step-route { font-size: 9px; color: var(--muted, #6b7280); }
    .dag-step-route code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .dag-arrow { font-size: 24px; color: var(--muted, #6b7280); padding: 0 8px; flex-shrink: 0; }

    .steps-table { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 4px; display: flex; flex-direction: column; }
    .steps-header, .steps-row { display: grid; grid-template-columns: 1fr 2fr 2fr 0.5fr 0.5fr 1fr; gap: 8px; padding: 8px 12px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .steps-header { background: #1f2937; font-weight: 600; color: var(--muted, #9ca3af); text-transform: uppercase; font-size: 10px; letter-spacing: 0.3px; border-radius: 4px 4px 0 0; }
    .steps-row { border-top: 1px solid var(--border, #1f2937); }
    .cell-id { color: #6ee7b7; font-weight: 600; }
    .cell-title { color: var(--fg, #e5e7eb); }
    .cell-route code { color: #93c5fd; font-size: 10px; }
    .cell-bool { text-align: center; }
    .cell-next { color: #fcd34d; }

    .detail-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted, #9ca3af); padding: 40px; text-align: center; }
    .empty-icon { font-size: 48px; opacity: 0.4; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--fg, #e5e7eb); }
    .empty-desc { font-size: 13px; }
  `],
})
export class ProcessDesignerComponent {
  readonly selected = signal<ProcessInfo | null>(null);

  readonly allProcesses = computed<ReadonlyArray<ProcessInfo>>(() => {
    return extractProcesses();
  });

  readonly totalSteps = computed<number>(() =>
    this.allProcesses().reduce((sum, p) => sum + p.steps.length, 0),
  );

  select(p: ProcessInfo): void {
    this.selected.set(p);
  }
}
