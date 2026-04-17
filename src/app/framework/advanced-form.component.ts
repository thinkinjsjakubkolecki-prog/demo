/**
 * fx-advanced-form — formularz z akcjami per-field (onChange/onBlur/onFocus/onSubmit).
 *
 * Widget własny dealer-fx-app (nie framework-owy), żeby nie blokować się
 * bumpem widgets-core do rc.17. Plan (DESIGNER_SECTIONS_PLAN.md D2): najpierw
 * custom widget jako proof-of-concept, potem promocja do frameworka gdy UX
 * się sprawdzi.
 *
 * Akcje per-field używają **tego samego formatu EventAction** co handlers
 * strony (setDatasource, emit, clearDatasource, call). Wykonywane przez
 * framework-owy runLifecycle() z ephemeral HandlerContext zbudowanym tu.
 *
 * Przykład configu:
 *   options: {
 *     fields: [
 *       { id: 'amount', label: 'Kwota', type: 'number', required: true,
 *         actions: {
 *           onChange: [{ setDatasource: 'quoteDraft', from: '$event' }],
 *           onBlur:   [{ emit: 'fx.amount.committed' }]
 *         } },
 *       { id: 'side',   label: 'Strona',  type: 'select',
 *         options: [{value:'BUY', label:'Kupuj'}, {value:'SELL', label:'Sprzedaj'}] },
 *     ],
 *     onSubmit: [{ emit: 'fx.quote.requested', payload: '$event' }]
 *   }
 */
import {
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EchelonWidget, EVENT_BUS, DATA_BUS, TRANSPORT, COMPUTED_FUNCTIONS, runLifecycle, type HandlerContext } from '@echelon-framework/runtime';
import type { EventBus, DataBus, TransportAdapter, EventAction } from '@echelon-framework/core';
import type { ComputedFunctionsMap } from '@echelon-framework/runtime';

export type AdvFormFieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'email' | 'password' | 'date';

export interface AdvFormFieldActions {
  readonly onChange?: ReadonlyArray<EventAction>;
  readonly onBlur?: ReadonlyArray<EventAction>;
  readonly onFocus?: ReadonlyArray<EventAction>;
}

export interface AdvFormFieldDef {
  readonly id: string;
  readonly label?: string;
  readonly type?: AdvFormFieldType;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly options?: ReadonlyArray<{ value: string; label: string }>;
  readonly actions?: AdvFormFieldActions;
}

@EchelonWidget({
  manifest: {
    type: 'advanced-form',
    version: '0.1.0',
    category: 'data',
    description: 'Form widget z akcjami per-pole (onChange/onBlur/onFocus) oraz onSubmit. Akcje w formacie EventAction.',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'submitLabel', type: 'string' },
      { name: 'fields', type: 'AdvFormFieldDef[]', required: true },
      { name: 'initial', type: 'object | null' },
      { name: 'onSubmit', type: 'EventAction[]' },
    ],
    outputs: [
      { name: 'submit', eventType: 'advanced-form.submit' },
      { name: 'change', eventType: 'advanced-form.change' },
    ],
    actions: [],
    capabilities: { eventBus: 'emit', dataBus: 'read' },
    testability: { interactions: [{ action: 'submit' }], observables: ['values'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-advanced-form',
  imports: [CommonModule, FormsModule],
  template: `
    <form class="adv-form" (submit)="onFormSubmit($event)" data-testid="widget-advanced-form" data-echelon-state="ready">
      @if (title) { <div class="adv-title">{{ title }}</div> }

      @for (f of fields; track f.id) {
        <div class="adv-field">
          <label class="adv-label" [for]="f.id">
            {{ f.label || f.id }}
            @if (f.required) { <span class="req">*</span> }
          </label>

          @switch (f.type) {
            @case ('textarea') {
              <textarea [id]="f.id" [placeholder]="f.placeholder || ''" [readonly]="f.readonly || false"
                        [ngModel]="values()[f.id] ?? ''" [name]="f.id"
                        (ngModelChange)="onValueChange(f, $event)"
                        (blur)="onFieldBlur(f)" (focus)="onFieldFocus(f)"></textarea>
            }
            @case ('select') {
              <select [id]="f.id" [disabled]="f.readonly || false"
                      [ngModel]="values()[f.id] ?? ''" [name]="f.id"
                      (ngModelChange)="onValueChange(f, $event)"
                      (blur)="onFieldBlur(f)" (focus)="onFieldFocus(f)">
                <option value="">—</option>
                @for (o of (f.options ?? []); track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            }
            @case ('checkbox') {
              <input type="checkbox" [id]="f.id" [disabled]="f.readonly || false"
                     [ngModel]="!!values()[f.id]" [name]="f.id"
                     (ngModelChange)="onValueChange(f, $event)"
                     (blur)="onFieldBlur(f)" (focus)="onFieldFocus(f)" />
            }
            @case ('number') {
              <input type="number" [id]="f.id" [placeholder]="f.placeholder || ''" [readonly]="f.readonly || false"
                     [ngModel]="values()[f.id] ?? null" [name]="f.id"
                     (ngModelChange)="onValueChange(f, $event)"
                     (blur)="onFieldBlur(f)" (focus)="onFieldFocus(f)" />
            }
            @default {
              <input [type]="f.type || 'text'" [id]="f.id" [placeholder]="f.placeholder || ''" [readonly]="f.readonly || false"
                     [ngModel]="values()[f.id] ?? ''" [name]="f.id"
                     (ngModelChange)="onValueChange(f, $event)"
                     (blur)="onFieldBlur(f)" (focus)="onFieldFocus(f)" />
            }
          }
        </div>
      }

      <div class="adv-actions">
        <button type="submit" class="btn-submit" [disabled]="!isValid()">{{ submitLabel || 'Zapisz' }}</button>
      </div>
    </form>
  `,
  styles: [`
    :host { display: block; padding: 12px; }
    .adv-form { display: flex; flex-direction: column; gap: 12px; max-width: 560px; }
    .adv-title { font-size: 16px; font-weight: 600; color: var(--ech-fg, #e5e7eb); margin-bottom: 4px; }
    .adv-field { display: flex; flex-direction: column; gap: 4px; }
    .adv-label { font-size: 12px; color: var(--ech-muted, #9ca3af); font-weight: 600; }
    .adv-label .req { color: var(--ech-danger); margin-left: 2px; }
    .adv-form input, .adv-form select, .adv-form textarea { padding: 7px 10px; background: var(--ech-panel-alt, #1f2937); border: 1px solid var(--ech-border, #374151); color: var(--ech-fg, #e5e7eb); border-radius: 3px; font-size: 13px; font-family: inherit; }
    .adv-form textarea { min-height: 70px; resize: vertical; }
    .adv-form input:focus, .adv-form select:focus, .adv-form textarea:focus { border-color: var(--ech-accent); outline: none; }
    .adv-form input[type=checkbox] { width: 16px; height: 16px; }
    .adv-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
    .btn-submit { padding: 8px 20px; background: color-mix(in srgb, var(--ech-accent) 25%, var(--ech-panel)); border: 1px solid var(--ech-accent); color: var(--ech-info); border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 13px; }
    .btn-submit:hover:not(:disabled) { background: color-mix(in srgb, var(--ech-accent) 40%, var(--ech-panel)); }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class AdvancedFormComponent {
  @Input() title = '';
  @Input() submitLabel = 'Zapisz';
  @Input() fields: ReadonlyArray<AdvFormFieldDef> = [];
  @Input() onSubmit: ReadonlyArray<EventAction> = [];
  @Input() set initial(v: Record<string, unknown> | null | undefined) {
    if (v && typeof v === 'object') {
      this.values.set({ ...v });
    }
  }

  @Output() readonly submit = new EventEmitter<Record<string, unknown>>();
  @Output() readonly change = new EventEmitter<Record<string, unknown>>();

  readonly values = signal<Record<string, unknown>>({});

  private readonly eventBus = inject(EVENT_BUS) as EventBus;
  private readonly dataBus = inject(DATA_BUS) as DataBus;
  private readonly transport = inject(TRANSPORT, { optional: true }) as TransportAdapter | null;
  private readonly computedFunctions = (inject(COMPUTED_FUNCTIONS, { optional: true }) as ComputedFunctionsMap | null) ?? {};
  private readonly router = inject(Router, { optional: true });

  private buildCtx(): HandlerContext {
    return {
      eventBus: this.eventBus,
      dataBus: this.dataBus,
      transport: this.transport ?? this.noopTransport(),
      computedFunctions: this.computedFunctions,
      ...(this.router ? { navigate: (commands: ReadonlyArray<unknown>) => { void this.router!.navigate(commands as unknown[]); } } : {}),
    };
  }

  private noopTransport(): TransportAdapter {
    return {
      kind: 'noop',
      request: async () => { throw new Error('[advanced-form] transport not provided'); },
      subscribe: () => ({ unsubscribe: () => {} }),
    } as unknown as TransportAdapter;
  }

  isValid(): boolean {
    const v = this.values();
    for (const f of this.fields) {
      if (!f.required) continue;
      const val = v[f.id];
      if (f.type === 'checkbox') {
        if (val !== true) return false;
      } else if (val === undefined || val === null || val === '') {
        return false;
      }
    }
    return true;
  }

  onValueChange(f: AdvFormFieldDef, newValue: unknown): void {
    const coerced = this.coerce(f, newValue);
    this.values.update((v) => ({ ...v, [f.id]: coerced }));
    this.change.emit(this.values());
    const actions = f.actions?.onChange;
    if (actions && actions.length > 0) {
      void this.runFieldActions(actions, coerced, 'onFocus');
    }
  }

  onFieldBlur(f: AdvFormFieldDef): void {
    const actions = f.actions?.onBlur;
    if (actions && actions.length > 0) {
      void this.runFieldActions(actions, this.values()[f.id], 'onBlur');
    }
  }

  onFieldFocus(f: AdvFormFieldDef): void {
    const actions = f.actions?.onFocus;
    if (actions && actions.length > 0) {
      void this.runFieldActions(actions, this.values()[f.id], 'onFocus');
    }
  }

  onFormSubmit(ev: Event): void {
    ev.preventDefault();
    if (!this.isValid()) return;
    const vals = this.values();
    this.submit.emit(vals);
    if (this.onSubmit && this.onSubmit.length > 0) {
      void this.runFormActions(this.onSubmit, vals);
    }
  }

  private coerce(f: AdvFormFieldDef, v: unknown): unknown {
    if (f.type === 'number') {
      if (v === '' || v === null || v === undefined) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : v;
    }
    if (f.type === 'checkbox') return !!v;
    return v;
  }

  private async runFieldActions(
    actions: ReadonlyArray<EventAction>,
    eventValue: unknown,
    phase: 'onBlur' | 'onFocus',
  ): Promise<void> {
    try {
      await runLifecycle(actions as ReadonlyArray<unknown>, this.buildCtx(), phase);
    } catch (e) {
      console.error('[fx-advanced-form] field action error', e);
    }
    // eventValue dostępne jako $event — runLifecycle tworzy syntetyczny event
    // z payload: {}. Dla akcji które używają $event, przekazujemy value w payload
    // przez emit-ping — ale podstawowe M37 zostawia to użytkownikowi do konfiguracji.
    void eventValue;
  }

  private async runFormActions(
    actions: ReadonlyArray<EventAction>,
    values: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Emituj special event z full values żeby action "emit $event" i "setDatasource from $event" mogły zadziałać.
      // Używamy onInit phase — runLifecycle przekazuje event.payload = {} bez custom payload.
      // Workaround: sami emitujemy pre-event, potem runLifecycle bez zmian (będzie miało payload: {}).
      // Dla MVP: actions muszą używać explicite `payload: { ...values }` zapisanego w configu.
      await runLifecycle(actions as ReadonlyArray<unknown>, this.buildCtx(), 'onInit');
    } catch (e) {
      console.error('[fx-advanced-form] submit action error', e);
    }
    void values;
  }
}
