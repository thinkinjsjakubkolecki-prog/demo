/**
 * Candlestick chart — echelon-widget z inline SVG rendererem.
 *
 * Demo v0.2 rc.15: pokazuje jak programowo używać feature-flag gate
 * (przez `isFeatureFlagAllowed`) oraz jak osadzić prosty wizualizator
 * danych OHLC. Pełny ECharts wrap zostaje na rc.16 gdy chart adapter
 * DI token wejdzie do frameworka.
 */
import { ElementRef, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EchelonWidget } from '@echelon-framework/runtime';
import { FEATURE_FLAGS } from '@echelon-framework/core';
import type { FeatureFlagService } from '@echelon-framework/core';
import { isFeatureFlagAllowed } from '@echelon-framework/runtime';

interface OhlcRow {
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

@EchelonWidget({
  manifest: {
    type: 'candlestick-chart',
    version: '0.1.0',
    category: 'chart',
    description: 'Candlestick OHLC chart (inline SVG).',
    inputs: [
      { name: 'data', type: 'array', required: true },
      { name: 'options', type: 'object' },
    ],
    outputs: [],
    actions: [],
    capabilities: { dataBus: 'read' },
    testability: { interactions: [], observables: ['chart-flag-disabled', 'candlestick-chart', 'chart-empty'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-candlestick-chart',
  imports: [CommonModule],
  template: `
    @if (!flagPassed) {
      <div class="gated" data-testid="chart-flag-disabled" data-echelon-state="ready">
        <span class="ic">🔒</span>
        <span>Widget ukryty — feature flag <code>{{ requiresFlag }}</code> wyłączona.</span>
      </div>
    } @else if (data && data.length > 0) {
      <div class="chart" data-testid="candlestick-chart" data-echelon-state="ready">
        <svg [attr.viewBox]="'0 0 ' + svgWidth + ' 140'" preserveAspectRatio="none">
          <line [attr.x1]="0" [attr.x2]="svgWidth" y1="130" y2="130" stroke="#374151" stroke-width="1"/>
          @for (row of data; track row.timestamp; let i = $index) {
            <g [attr.transform]="'translate(' + (i * colWidth + colWidth / 2) + ',0)'">
              <line [attr.x1]="0" [attr.x2]="0"
                    [attr.y1]="scaleY(row.high)" [attr.y2]="scaleY(row.low)"
                    [attr.stroke]="row.close >= row.open ? '#10b981' : '#ef4444'" stroke-width="1.5"/>
              <rect [attr.x]="-5" [attr.width]="10"
                    [attr.y]="scaleY(max(row.open, row.close))"
                    [attr.height]="max(2, abs(scaleY(row.open) - scaleY(row.close)))"
                    [attr.fill]="row.close >= row.open ? '#10b981' : '#ef4444'"/>
              <text [attr.x]="0" [attr.y]="135" text-anchor="middle" fill="#6b7280" font-size="8">{{ shortDate(row.timestamp) }}</text>
            </g>
          }
        </svg>
        <div class="legend">P&amp;L OHLC · {{ data.length }} punktów · zielone = close &gt; open</div>
      </div>
    } @else {
      <div class="empty" data-testid="chart-empty" data-echelon-state="ready">Brak danych OHLC</div>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; min-height: 180px; background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 12px; }
    .gated, .empty { display: flex; align-items: center; justify-content: center; height: 100%; min-height: 160px; color: var(--muted, #9ca3af); font-size: 13px; gap: 8px; padding: 16px; text-align: center; }
    .ic { font-size: 18px; }
    code { background: #1f2937; padding: 2px 6px; border-radius: 3px; font-size: 12px; color: #60a5fa; }
    .chart { display: flex; flex-direction: column; gap: 6px; height: 100%; }
    .chart svg { width: 100%; height: 100%; min-height: 140px; }
    .legend { font-size: 11px; color: var(--muted, #9ca3af); text-align: center; padding-top: 4px; border-top: 1px dashed #1f2937; }
  `],
})
export class CandlestickChartComponent {
  @Input() data: OhlcRow[] = [];
  @Input() options: { requiresFlag?: string; xField?: string } = {};

  // Angular provider dla EchelonToken jest zarejestrowany w app.config.ts —
  // cast przez `as never` bo TS nie wie że EchelonToken jest zgodny z InjectionToken.
  private readonly featureFlags = inject(FEATURE_FLAGS as never, { optional: true }) as FeatureFlagService | null;

  get requiresFlag(): string | undefined { return this.options?.requiresFlag; }
  get flagPassed(): boolean {
    if (!this.requiresFlag) return true;
    if (!this.featureFlags) return true;
    return isFeatureFlagAllowed(this.featureFlags, this.requiresFlag);
  }

  get colWidth(): number { return this.data?.length ? this.svgWidth / this.data.length : 24; }
  get svgWidth(): number { return Math.max(200, (this.data?.length ?? 0) * 28); }

  scaleY(v: number): number {
    if (!this.data?.length) return 65;
    const all = this.data.flatMap((r) => [r.high, r.low, r.open, r.close]);
    const maxV = Math.max(...all);
    const minV = Math.min(...all);
    const range = maxV - minV || 1;
    return 10 + ((maxV - v) / range) * 110;
  }

  max = Math.max;
  abs = Math.abs;
  shortDate(s: string): string { return String(s).slice(5, 10); }
}

// Zapobiegamy "unused variable" dla ElementRef — potrzebny dla przyszłej integracji ECharts.
void ElementRef;
