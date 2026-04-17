/**
 * fx-theme-manager — wybór i podgląd CSS temy.
 * Predefiniowane temy z frameworka + custom.
 */
import { computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';
import { BUILT_IN_THEMES, applyTheme, getCurrentThemeId, type CssTheme } from './css-themes';

const STORAGE_KEY = 'dealer-fx:theme';

@EchelonWidget({
  manifest: {
    type: 'theme-manager',
    version: '1.0.0',
    category: 'designer',
    description: 'Wybór CSS temy — predefiniowane z frameworka + custom variables.',
    inputs: [],
    outputs: [],
    actions: [],
    capabilities: {},
    testability: { interactions: [], observables: ['theme-manager'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-theme-manager',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" data-testid="theme-manager" data-echelon-state="ready">
      <div class="header">
        <h2>🎨 CSS Temy</h2>
        <p class="desc">
          Predefiniowane temy z frameworka. Wybór natychmiast zmienia wygląd aplikacji.
          Wszystkie komponenty używają tych samych CSS custom properties.
        </p>
      </div>

      <div class="themes-grid">
        @for (theme of themes; track theme.id) {
          <button type="button" class="theme-card" [class.active]="activeThemeId() === theme.id"
                  (click)="selectTheme(theme)">
            <div class="theme-preview" [style.background]="theme.preview">
              <span class="preview-accent" [style.color]="theme.variables['--ech-accent']">Aa</span>
            </div>
            <div class="theme-info">
              <div class="theme-name">{{ theme.name }}</div>
              <div class="theme-desc">{{ theme.description }}</div>
              <span class="theme-cat">{{ theme.category }}</span>
            </div>
            @if (activeThemeId() === theme.id) {
              <div class="active-badge">✓ aktywna</div>
            }
          </button>
        }
      </div>

      @if (activeTheme(); as t) {
        <div class="variables-section">
          <div class="var-header">
            <span>CSS Custom Properties — {{ t.name }}</span>
            <button type="button" class="btn-copy" (click)="copyCss()">{{ copied() ? '✓' : '📋' }} CSS</button>
          </div>
          <div class="var-grid">
            @for (v of variableEntries(); track v.key) {
              <div class="var-row">
                <code class="var-key">{{ v.key }}</code>
                @if (v.isColor) {
                  <span class="color-swatch" [style.background]="v.value"></span>
                }
                <span class="var-value">{{ v.value }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; padding: 16px; color: var(--ech-fg, #e5e7eb); }
    .wrap { background: var(--ech-panel, #0f172a); border: 1px solid var(--ech-border, #1f2937); border-radius: 6px; padding: 20px; }
    .header h2 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--ech-accent, #58a6ff); }
    .desc { margin: 0 0 20px; font-size: 12px; color: var(--ech-muted, #9ca3af); line-height: 1.5; }

    .themes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .theme-card { background: var(--ech-panel-alt, #111827); border: 2px solid var(--ech-border, #1f2937); border-radius: 8px; padding: 0; cursor: pointer; text-align: left; display: flex; flex-direction: column; overflow: hidden; transition: border-color 0.15s; font-family: inherit; color: var(--ech-fg, #e5e7eb); }
    .theme-card:hover { border-color: var(--ech-accent, #58a6ff); }
    .theme-card.active { border-color: var(--ech-accent, #58a6ff); box-shadow: 0 0 0 1px var(--ech-accent, #58a6ff); }

    .theme-preview { height: 48px; display: flex; align-items: center; justify-content: center; }
    .preview-accent { font-size: 20px; font-weight: 700; }
    .theme-info { padding: 10px 12px; flex: 1; }
    .theme-name { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
    .theme-desc { font-size: 10px; color: var(--ech-muted, #9ca3af); line-height: 1.4; margin-bottom: 4px; }
    .theme-cat { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ech-muted, #6b7280); background: var(--ech-panel, #0f172a); padding: 1px 5px; border-radius: 2px; }
    .active-badge { padding: 4px 10px; background: var(--ech-accent, #58a6ff); color: #000; font-size: 10px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }

    .variables-section { background: var(--ech-panel-alt, #111827); border: 1px solid var(--ech-border, #1f2937); border-radius: 6px; overflow: hidden; }
    .var-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--ech-border, #1f2937); font-size: 11px; color: var(--ech-muted, #9ca3af); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .btn-copy { padding: 3px 10px; background: #1e3a5f; border: 1px solid #3b82f6; color: #e0f2fe; border-radius: 2px; font-size: 10px; cursor: pointer; font-family: inherit; }
    .var-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; max-height: 400px; overflow-y: auto; }
    .var-row { display: flex; align-items: center; gap: 8px; padding: 5px 14px; border-bottom: 1px solid var(--ech-border, #0f172a); }
    .var-key { font-size: 10px; color: var(--ech-accent, #58a6ff); flex: 1; }
    .color-swatch { width: 14px; height: 14px; border-radius: 2px; border: 1px solid var(--ech-border, #374151); flex-shrink: 0; }
    .var-value { font-size: 10px; color: var(--ech-fg, #e5e7eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  `],
})
export class ThemeManagerComponent {
  readonly themes = BUILT_IN_THEMES;
  readonly activeThemeId = signal(getCurrentThemeId());
  readonly copied = signal(false);

  readonly activeTheme = computed<CssTheme | null>(() =>
    this.themes.find((t) => t.id === this.activeThemeId()) ?? null);

  readonly variableEntries = computed<ReadonlyArray<{ key: string; value: string; isColor: boolean }>>(() => {
    const t = this.activeTheme();
    if (!t) return [];
    return Object.entries(t.variables).map(([key, value]) => ({
      key, value,
      isColor: value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl'),
    }));
  });

  constructor() {
    const saved = typeof window !== 'undefined' ? window.localStorage?.getItem(STORAGE_KEY) : null;
    if (saved) {
      const theme = this.themes.find((t) => t.id === saved);
      if (theme) { applyTheme(theme); this.activeThemeId.set(saved); }
    }
  }

  selectTheme(theme: CssTheme): void {
    applyTheme(theme);
    this.activeThemeId.set(theme.id);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, theme.id);
    }
  }

  copyCss(): void {
    const t = this.activeTheme();
    if (!t) return;
    const css = `:root[data-ech-theme="${t.id}"] {\n${Object.entries(t.variables).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
    navigator.clipboard.writeText(css).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
