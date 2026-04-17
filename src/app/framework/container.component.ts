/**
 * fx-container — widget-kontener który może zawierać inne widgety jako children.
 *
 * Pozwala na hierarchiczne układanie UI: page ma container → container ma
 * children (które mogą być innymi containerami). Każdy level ma własny
 * 12-col grid layout.
 *
 * Technicznie: container przechowuje sub-config (PageConfig-like) w
 * options.childConfig. Renderuje go przez framework-owy PageRendererComponent
 * (imperative mount — jak draft-page-renderer). To pozwala reuse całego
 * runtime: bindings, events, ACL, computed — wszystko działa w children.
 *
 * Model danych:
 *   options: {
 *     title?: string,
 *     style?: 'card' | 'section' | 'raw',
 *     childConfig: PageConfig
 *   }
 *
 * Designer (M29+) wchodzi w scope container-a: klik → canvas edytuje
 * options.childConfig.page zamiast page-top-level.
 */
import {
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
  inject,
  type ComponentRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EchelonWidget } from '@echelon-framework/runtime';
import { PageRendererComponent } from '@echelon-framework/runtime';
import type { PageConfig } from '@echelon-framework/core';

interface ContainerOptions {
  readonly title?: string;
  readonly style?: 'card' | 'section' | 'raw';
  readonly childConfig?: PageConfig;
}

@EchelonWidget({
  manifest: {
    type: 'container',
    version: '0.1.0',
    category: 'layout',
    description: 'Container widget — może zawierać inne widgety jako children przez options.childConfig.',
    icon: '📦',
    inputs: [
      { name: 'title', type: 'string' },
    ],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: ['container'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-container',
  imports: [CommonModule],
  template: `
    <div class="container-box" [class.card]="style === 'card'" [class.section]="style === 'section'">
      @if (title) {
        <div class="container-header">{{ title }}</div>
      }
      <div class="container-body" #host></div>
      @if (!options?.childConfig) {
        <div class="container-empty">Pusty kontener — w designerze edytuj childConfig</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; min-height: 120px; }
    .container-box { width: 100%; height: 100%; display: flex; flex-direction: column; }
    .container-box.card { background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #374151); border-radius: 6px; padding: 12px; }
    .container-box.section { padding: 8px 0; }
    .container-header { font-size: 14px; font-weight: 600; color: var(--ech-fg, #e5e7eb); padding-bottom: 8px; border-bottom: 1px solid var(--ech-border, #1f2937); margin-bottom: 10px; }
    .container-body { flex: 1; min-height: 0; }
    .container-empty { padding: 40px 20px; text-align: center; color: var(--ech-muted, #9ca3af); font-style: italic; font-size: 12px; border: 1px dashed var(--ech-border, #374151); border-radius: 4px; }
  `],
})
export class ContainerComponent implements OnChanges, OnDestroy {
  @Input() options?: ContainerOptions;
  @Input() title?: string;
  @ViewChild('host', { read: ElementRef, static: false })
  set hostEl(el: ElementRef<HTMLElement> | undefined) {
    this._hostEl = el ?? null;
    this.remount();
  }
  private _hostEl: ElementRef<HTMLElement> | null = null;
  private readonly vcr = inject(ViewContainerRef);
  private innerRef: ComponentRef<PageRendererComponent> | null = null;

  get style(): 'card' | 'section' | 'raw' {
    return this.options?.style ?? 'card';
  }

  ngOnChanges(): void {
    this.remount();
  }

  private remount(): void {
    const childConfig = this.options?.childConfig;
    if (!childConfig) {
      this.destroyInner();
      return;
    }
    if (!this._hostEl) return;
    if (!this.innerRef) {
      this.innerRef = this.vcr.createComponent(PageRendererComponent);
      const root = this.innerRef.location.nativeElement as HTMLElement;
      this._hostEl.nativeElement.appendChild(root);
    }
    this.innerRef.setInput('config', childConfig);
    this.innerRef.changeDetectorRef.markForCheck();
  }

  private destroyInner(): void {
    this.innerRef?.destroy();
    this.innerRef = null;
  }

  ngOnDestroy(): void {
    this.destroyInner();
  }
}
