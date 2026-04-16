/**
 * DraftPageRenderer — component dla dynamicznego route `/draft/:id`.
 *
 * Odczytuje draft z DraftPageStoreService i renderuje przez framework-owy
 * PageRendererComponent. Dzięki temu drafty z designera są dostępne przez
 * zwykły URL bez potrzeby rebuilu aplikacji.
 *
 * Flow:
 *   URL /draft/test-page
 *   → ActivatedRoute.params.id = 'test-page'
 *   → DraftPageStoreService.get('test-page') → PersistedDraft
 *   → <ech-page-renderer [config]="draft.config">
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PageRendererComponent } from '@echelon-framework/runtime';
import { DraftPageStoreService } from '../services/draft-page-store.service';

@Component({
  selector: 'fx-draft-page-renderer',
  standalone: true,
  imports: [CommonModule, RouterLink, PageRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft(); as d) {
      <div class="draft-banner">
        <span class="icon">⚡</span>
        <span class="label">Draft Page — renderowany z localStorage</span>
        <span class="meta">id: <code>{{ d.id }}</code> · updated {{ formatDate(d.updatedAt) }}</span>
        <a routerLink="/designer" class="edit-link">✎ Edytuj w designer</a>
      </div>
      <ech-page-renderer [config]="d.config"></ech-page-renderer>
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
  private readonly paramsSignal = toSignal(this.route.params);

  readonly requestedId = computed<string>(() => String(this.paramsSignal()?.['id'] ?? ''));
  readonly draft = computed(() => {
    const id = this.requestedId();
    if (!id) return null;
    // Czytamy store().all() — reaktywne na .save/.remove
    const all = this.store.all();
    return all.find((d) => d.id === id) ?? null;
  });

  formatDate(ts: number): string {
    if (!ts) return '?';
    try {
      return new Date(ts).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '?';
    }
  }
}
