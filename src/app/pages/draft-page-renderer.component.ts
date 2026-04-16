/**
 * DraftPageRenderer — component dla dynamicznego route `/draft/:id`.
 *
 * Odczytuje draft z DraftPageStoreService i renderuje przez framework-owy
 * PageRendererComponent. Używa imperative mount (ViewContainerRef.createComponent)
 * zamiast template `<ech-page-renderer>` żeby obejść Angular 21 strict check
 * standalone flag na komponentach z pakietów tsc-built (@echelon-framework/runtime).
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  ViewChild,
  ViewContainerRef,
  type ComponentRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PageRendererComponent } from '@echelon-framework/runtime';
import type { PageConfig } from '@echelon-framework/core';
import { DraftPageStoreService, type PersistedDraft } from '../services/draft-page-store.service';

@Component({
  selector: 'fx-draft-page-renderer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft(); as d) {
      <div class="draft-banner">
        <span class="icon">⚡</span>
        <span class="label">Draft Page — renderowany z localStorage</span>
        <span class="meta">id: <code>{{ d.id }}</code> · updated {{ formatDate(d.updatedAt) }}</span>
        <a routerLink="/designer" class="edit-link">✎ Edytuj w designer</a>
      </div>
      <div class="renderer-host" #rendererHost></div>
    } @else {
      <div class="not-found">
        <div class="icon">❓</div>
        <div class="title">Draft "{{ requestedId() }}" nie istnieje</div>
        <div class="desc">
          Ten draft nie został znaleziony w localStorage. Mógł zostać usunięty
          albo nigdy nie istniał w tej przeglądarce.
        </div>
        <a routerLink="/designer" class="btn-primary">↗ Otwórz designer</a>
      </div>
    }
  `,
  styles: [`
    :host { display: block; padding: 0; }
    .draft-banner { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: #713f1233; border-left: 3px solid #f59e0b; font-size: 12px; color: #fef3c7; margin-bottom: 8px; }
    .draft-banner .icon { font-size: 14px; }
    .draft-banner .label { font-weight: 600; }
    .draft-banner .meta { color: var(--muted, #9ca3af); }
    .draft-banner code { background: #1f2937; padding: 1px 6px; border-radius: 2px; color: #93c5fd; }
    .draft-banner .edit-link { margin-left: auto; color: #60a5fa; text-decoration: none; }
    .draft-banner .edit-link:hover { text-decoration: underline; }

    .renderer-host { padding: 0 16px; }

    .not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; text-align: center; }
    .not-found .icon { font-size: 48px; opacity: 0.5; }
    .not-found .title { font-size: 18px; font-weight: 600; color: var(--fg, #e5e7eb); }
    .not-found .desc { font-size: 13px; color: var(--muted, #9ca3af); max-width: 420px; line-height: 1.5; }
    .btn-primary { padding: 8px 16px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 3px; font-size: 13px; text-decoration: none; margin-top: 10px; }
    .btn-primary:hover { background: #1e40af; }
  `],
})
export class DraftPageRendererComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(DraftPageStoreService);
  private readonly vcr = inject(ViewContainerRef);
  private readonly paramsSignal = toSignal(this.route.params);

  readonly requestedId = computed<string>(() => String(this.paramsSignal()?.['id'] ?? ''));
  readonly draft = computed<PersistedDraft | null>(() => {
    const id = this.requestedId();
    if (!id) return null;
    return this.store.all().find((d) => d.id === id) ?? null;
  });

  @ViewChild('rendererHost', { read: ElementRef })
  set rendererHostEl(el: ElementRef<HTMLElement> | undefined) {
    this._hostEl = el ?? null;
    this.remountRenderer();
  }
  private _hostEl: ElementRef<HTMLElement> | null = null;
  private rendererRef: ComponentRef<PageRendererComponent> | null = null;

  constructor() {
    // Re-mount renderer gdy zmienia się draft config (edit w designer → auto-save
    // → store update → draft() computed zmienia się → tu).
    effect(() => {
      const d = this.draft();
      const cfg = d?.config ?? null;
      this.updateRendererConfig(cfg);
    });
  }

  private remountRenderer(): void {
    const d = this.draft();
    if (!d) return;
    this.updateRendererConfig(d.config);
  }

  private updateRendererConfig(config: PageConfig | null): void {
    if (!config) {
      if (this.rendererRef) {
        this.rendererRef.destroy();
        this.rendererRef = null;
      }
      return;
    }
    if (!this.rendererRef) {
      // Imperative create zamiast template → omija strict standalone check
      this.rendererRef = this.vcr.createComponent(PageRendererComponent);
      // Przenieś DOM do naszego host-a jeśli chcemy kontrolować jego lokację
      if (this._hostEl) {
        const root = this.rendererRef.location.nativeElement as HTMLElement;
        this._hostEl.nativeElement.appendChild(root);
      }
    }
    this.rendererRef.setInput('config', config);
    this.rendererRef.changeDetectorRef.markForCheck();
  }

  formatDate(ts: number): string {
    if (!ts) return '?';
    try {
      return new Date(ts).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '?';
    }
  }
}
