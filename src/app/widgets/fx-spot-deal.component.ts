/**
 * fx-spot-deal — pełny formularz transakcji FX spot z live pricing + RFQ flow.
 *
 * Jeden formularz, dwa tryby:
 *   NORMAL: parametry → WS pricing stream → submit
 *   RFQ:    kwota > limit → wstrzymaj stream → wyślij RFQ → czekaj na cenę → akceptuj/odrzuć
 *
 * Binduje się do spotPricing stream (bid/ask live) i pokazuje wyliczone
 * wartości w czasie rzeczywistym. Przy przekroczeniu limitu przechodzi w tryb
 * RFQ z oczekiwaniem na cenę z serwera.
 */
import {
  EventEmitter,
  Input,
  Output,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EchelonWidget } from '@echelon-framework/runtime';

interface SpotTick { readonly bid?: number; readonly ask?: number; }
interface RfqResponse {
  readonly status: 'idle' | 'pending' | 'price-received' | 'accepted' | 'rejected' | 'expired' | 'timeout';
  readonly price?: number;
  readonly refRate?: number;
  readonly validUntil?: number;
}

const LIMIT_AMOUNT = 500_000;
const REQUEST_TIMEOUT_SEC = 10;
const ACCEPT_TIMEOUT_SEC = 15;
const PAIRS = ['USDPLN', 'EURPLN', 'GBPPLN', 'CHFPLN', 'EURUSD'] as const;
const PAIR_MIDS: Record<string, number> = { USDPLN: 4.05, EURPLN: 4.28, GBPPLN: 5.12, CHFPLN: 4.55, EURUSD: 1.085 };

@EchelonWidget({
  manifest: {
    type: 'fx-spot-deal',
    version: '1.0.0',
    category: 'fx',
    description: 'Formularz FX Spot z live pricing stream + tryb RFQ przy limit-exceeded.',
    inputs: [
      { name: 'clientCode', type: 'string' },
      { name: 'clientName', type: 'string' },
      { name: 'spot', type: 'object' },
      { name: 'rfqResponse', type: 'object' },
    ],
    outputs: [
      { name: 'submit', eventType: 'fx-spot-deal.submitted' },
      { name: 'rfqRequest', eventType: 'fx-spot-deal.rfq-requested' },
      { name: 'rfqAccept', eventType: 'fx-spot-deal.rfq-accepted' },
      { name: 'rfqReject', eventType: 'fx-spot-deal.rfq-rejected' },
      { name: 'paramsChanged', eventType: 'fx-spot-deal.params-changed' },
    ],
    actions: [],
    capabilities: { eventBus: 'emit', dataBus: 'read' },
    testability: { interactions: [{ action: 'submit' }], observables: ['spot'], lifecycleGates: ['ready'] },
  },
  selector: 'fx-spot-deal',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="deal-form" data-testid="widget-fx-spot-deal" data-echelon-state="ready">

      @if (bookingPhase() === 'booking') {
        <div class="booking-overlay">
          <div class="booking-spinner"></div>
          <div class="booking-text">Księgowanie transakcji...</div>
        </div>
      }

      @if (bookingPhase() === 'success') {
        <div class="result-screen success">
          <div class="result-icon">✓</div>
          <div class="result-title">Transakcja zaksięgowana</div>
          <dl class="result-summary">
            <dt>Klient</dt><dd>{{ lastBooking()?.clientName || lastBooking()?.client }}</dd>
            <dt>Para</dt><dd>{{ lastBooking()?.pair }}</dd>
            <dt>Operacja</dt><dd>{{ lastBooking()?.side }}</dd>
            <dt>Kwota</dt><dd>{{ lastBooking()?.amount | number:'1.2-2' }}</dd>
            <dt>Kurs</dt><dd>{{ lastBooking()?.txRate }}</dd>
            @if (lastBooking()?.rfqPrice) { <dt>Cena RFQ</dt><dd>{{ lastBooking()?.rfqPrice }}</dd> }
            <dt>Typ</dt><dd>{{ lastBooking()?.dealType }}</dd>
            <dt>Ref</dt><dd>{{ lastBooking()?.bookingRef }}</dd>
          </dl>
          <div class="result-actions">
            <button type="button" class="btn-submit" (click)="newDeal()">+ Nowa transakcja</button>
          </div>
        </div>
      }

      @if (bookingPhase() === 'error') {
        <div class="result-screen error">
          <div class="result-icon error-icon">✕</div>
          <div class="result-title">Błąd księgowania</div>
          <div class="result-error">{{ bookingError() }}</div>
          <div class="result-actions">
            <button type="button" class="btn-rfq" (click)="retryFromError()">← Wróć do formularza</button>
          </div>
        </div>
      }

      @if (bookingPhase() === 'idle') {
      <div class="deal-header">
        <h3>FX Spot — Transakcja</h3>
        @if (rfqMode()) {
          <span class="mode-badge rfq">RFQ</span>
        } @else {
          <span class="mode-badge live">LIVE</span>
        }
      </div>

      <!-- ROW 1: Klient -->
      <div class="section">
        <div class="row-2">
          <div class="field"><label>Klient</label><input type="text" [value]="clientName || clientCode || '—'" disabled /></div>
          <div class="field"><label>Para walutowa</label>
            <select [(ngModel)]="pair" name="pair" (ngModelChange)="onParamsChange()">
              @for (p of pairs; track p) { <option [value]="p">{{ p }}</option> }
            </select>
          </div>
        </div>
      </div>

      <!-- ROW 2: Parametry -->
      <div class="section">
        <div class="row-4">
          <div class="field"><label>Operacja</label>
            <select [(ngModel)]="side" name="side" (ngModelChange)="onParamsChange()">
              <option value="SELL">SELL (Sprzedaj)</option>
              <option value="BUY">BUY (Kupuj)</option>
            </select>
          </div>
          <div class="field"><label>Kwota</label>
            <input type="number" [(ngModel)]="amount" name="amount" min="1" step="10000"
                   (ngModelChange)="onAmountChange()" [class.over-limit]="rfqMode()" />
            @if (rfqMode()) { <span class="limit-warn">Kwota > {{ limitDisplay }} — tryb RFQ</span> }
          </div>
          <div class="field"><label>Data waluty</label>
            <input type="date" [(ngModel)]="valueDate" name="valueDate" (ngModelChange)="onParamsChange()" />
          </div>
          <div class="field"><label>Typ</label>
            <input type="text" [value]="dealType()" disabled class="computed" />
          </div>
        </div>
      </div>

      <!-- ROW 3: Pricing -->
      <div class="section pricing" [class.rfq-active]="rfqMode()" [class.rfq-received]="rfqStatus() === 'price-received'">
        <div class="pricing-header">
          @if (!rfqMode()) { <span>📊 Live pricing</span> }
          @else if (rfqStatus() === 'pending') {
            <span class="blink">⏳ Oczekiwanie na cenę RFQ... {{ pendingTtl() }}s</span>
            <div class="progress-bar"><div class="progress-fill pending" [style.width.%]="pendingProgress()"></div></div>
          }
          @else if (rfqStatus() === 'price-received') {
            <span>💰 Cena z RFQ</span>
            <span class="ttl-badge" [class.critical]="rfqTtl() <= 5">{{ rfqTtl() }}s</span>
            <div class="progress-bar"><div class="progress-fill accept" [style.width.%]="acceptProgress()" [class.critical]="rfqTtl() <= 5"></div></div>
          }
          @else if (rfqStatus() === 'expired') { <span class="warn">⏰ Czas na akceptację minął</span> }
          @else if (rfqStatus() === 'timeout') { <span class="warn">⏰ Serwer nie odpowiedział w czasie</span> }
          @else if (rfqStatus() === 'rejected') { <span class="warn">✕ Odrzucono</span> }
          @else { <span>— tryb RFQ —</span> }
        </div>
        <div class="row-4">
          <div class="field"><label>Spot bid / ask</label>
            <div class="spot-display">
              @if (!rfqMode()) {
                <span class="tick">{{ spotBid() }} / {{ spotAsk() }}</span>
              } @else {
                <span class="no-stream">— stream wstrzymany —</span>
              }
            </div>
          </div>
          <div class="field"><label>Kurs transakcyjny</label>
            <div class="rate-display" [class.has-value]="txRate() !== null">
              {{ txRate() !== null ? txRate()!.toFixed(5) : '—' }}
            </div>
          </div>
          <div class="field"><label>Profit (PLN)</label>
            <div class="rate-display">{{ profitPln() !== null ? profitPln()!.toFixed(2) : '—' }}</div>
          </div>
          <div class="field"><label>Marża (pips)</label>
            <input type="number" [(ngModel)]="marginPips" name="margin" min="0" max="200" step="1"
                   (ngModelChange)="onParamsChange()" [disabled]="rfqMode() && rfqStatus() === 'price-received'" />
          </div>
        </div>
      </div>

      <!-- AKCJE -->
      <div class="actions-section">
        @if (!rfqMode()) {
          <!-- TRYB NORMALNY -->
          <button type="button" class="btn-submit" [disabled]="!canSubmit()" (click)="onSubmit()">
            ✓ Zatwierdź transakcję
          </button>
        } @else {
          @switch (rfqStatus()) {
            @case ('idle') {
              <button type="button" class="btn-rfq" (click)="sendRfq()">
                📨 Wyślij zapytanie RFQ
              </button>
            }
            @case ('pending') {
              <button type="button" class="btn-waiting" disabled>
                ⏳ Czekam na cenę...
              </button>
            }
            @case ('price-received') {
              <button type="button" class="btn-accept" (click)="acceptRfq()">
                ✓ Akceptuj cenę {{ rfqPrice()?.toFixed(5) }}
              </button>
              <button type="button" class="btn-reject" (click)="rejectRfq()">
                ✕ Odrzuć
              </button>
            }
            @case ('expired') {
              <div class="expired-info">⏰ Czas na akceptację minął. Wyślij ponownie lub zmień kwotę.</div>
              <button type="button" class="btn-rfq" (click)="sendRfq()">
                🔄 Ponowne zapytanie RFQ
              </button>
            }
            @case ('timeout') {
              <div class="expired-info">⏰ Serwer nie odpowiedział w ciągu {{ requestTimeoutSec }}s. Spróbuj ponownie.</div>
              <button type="button" class="btn-rfq" (click)="sendRfq()">
                🔄 Ponowne zapytanie RFQ
              </button>
            }
            @case ('rejected') {
              <div class="expired-info">Odrzucono cenę. Wyślij ponownie lub zmień parametry.</div>
              <button type="button" class="btn-rfq" (click)="sendRfq()">
                🔄 Ponowne zapytanie RFQ
              </button>
            }
          }
          <button type="button" class="btn-cancel" (click)="onCancel()">Anuluj</button>
        }
      </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .deal-form { background: var(--panel, #0f172a); border: 1px solid var(--border, #1f2937); border-radius: 8px; padding: 20px; color: var(--fg, #e5e7eb); }
    .deal-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .deal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--accent, #58a6ff); }
    .mode-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 3px; text-transform: uppercase; letter-spacing: 1px; }
    .mode-badge.live { background: #064e3b; color: #6ee7b7; border: 1px solid #10b981; }
    .mode-badge.rfq { background: #78350f; color: #fcd34d; border: 1px solid #f59e0b; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

    .section { margin-bottom: 16px; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted, #9ca3af); font-weight: 600; }
    .field input, .field select { padding: 8px 10px; background: var(--panel-alt, #1f2937); border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .field input:disabled, .field select:disabled { opacity: 0.6; }
    .field input.computed { background: transparent; border-color: transparent; color: #6ee7b7; font-weight: 600; padding-left: 0; }
    .field input.over-limit { border-color: #f59e0b; background: #78350f22; }
    .limit-warn { font-size: 10px; color: #fcd34d; font-weight: 600; }

    .pricing { background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 14px; }
    .pricing.rfq-active { border-color: #f59e0b66; background: #78350f0d; }
    .pricing.rfq-received { border-color: #10b98166; background: #064e3b0d; }
    .pricing-header { font-size: 11px; color: var(--muted, #9ca3af); font-weight: 600; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    .pricing-header .blink { animation: pulse 1.5s infinite; color: #fcd34d; }
    .pricing-header .warn { color: #fca5a5; }

    .spot-display { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; padding: 6px 0; }
    .tick { color: #6ee7b7; font-weight: 700; }
    .no-stream { color: var(--muted, #6b7280); font-style: italic; font-size: 12px; }
    .rate-display { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; padding: 6px 0; color: var(--muted, #6b7280); }
    .rate-display.has-value { color: #93c5fd; font-weight: 700; }

    .actions-section { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border, #1f2937); flex-wrap: wrap; }
    .btn-submit { padding: 10px 24px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 4px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-submit:hover:not(:disabled) { background: #065f46; }
    .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-rfq { padding: 10px 24px; background: #78350f; border: 1px solid #f59e0b; color: #fef3c7; border-radius: 4px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-rfq:hover { background: #92400e; }
    .btn-waiting { padding: 10px 24px; background: #1f2937; border: 1px solid #374151; color: var(--muted, #9ca3af); border-radius: 4px; font-size: 13px; cursor: not-allowed; }
    .btn-accept { padding: 10px 24px; background: #064e3b; border: 1px solid #10b981; color: #d1fae5; border-radius: 4px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-accept:hover { background: #065f46; }
    .btn-reject { padding: 10px 20px; background: #7f1d1d33; border: 1px solid #ef4444; color: #fecaca; border-radius: 4px; font-size: 13px; cursor: pointer; }
    .btn-reject:hover { background: #7f1d1d66; }
    .btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid var(--border, #374151); color: var(--fg, #e5e7eb); border-radius: 4px; font-size: 12px; cursor: pointer; margin-left: auto; }
    .expired-info { font-size: 12px; color: #fcd34d; width: 100%; margin-bottom: 6px; }

    .booking-overlay { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 16px; }
    .booking-spinner { width: 48px; height: 48px; border: 4px solid var(--border, #374151); border-top-color: var(--accent, #58a6ff); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .booking-text { font-size: 14px; color: var(--muted, #9ca3af); }

    .result-screen { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; gap: 16px; text-align: center; }
    .result-icon { font-size: 48px; width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .result-screen.success .result-icon { background: #064e3b; color: #6ee7b7; border: 2px solid #10b981; }
    .result-screen.error .result-icon { background: #7f1d1d; color: #fca5a5; border: 2px solid #ef4444; }
    .result-title { font-size: 20px; font-weight: 700; color: var(--fg, #e5e7eb); }
    .result-error { font-size: 13px; color: #fca5a5; background: #7f1d1d33; border: 1px solid #ef444466; padding: 10px 16px; border-radius: 4px; max-width: 400px; }
    .result-summary { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 20px; text-align: left; background: var(--panel-alt, #111827); border: 1px solid var(--border, #1f2937); border-radius: 6px; padding: 16px 20px; min-width: 360px; }
    .result-summary dt { color: var(--muted, #9ca3af); font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; align-self: center; }
    .result-summary dd { color: var(--fg, #e5e7eb); margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
    .result-actions { display: flex; gap: 10px; margin-top: 8px; }

    .progress-bar { width: 100%; height: 6px; background: #1f2937; border-radius: 3px; margin-top: 6px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.25s linear; }
    .progress-fill.pending { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .progress-fill.accept { background: linear-gradient(90deg, #10b981, #6ee7b7); }
    .progress-fill.accept.critical { background: linear-gradient(90deg, #ef4444, #fca5a5); animation: pulse 0.5s infinite; }
    .ttl-badge { font-size: 14px; font-weight: 700; color: #6ee7b7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-left: auto; }
    .ttl-badge.critical { color: #ef4444; animation: pulse 0.5s infinite; }
  `],
})
export class FxSpotDealComponent {
  @Input() clientCode = '';
  @Input() clientName = '';
  @Input() set spot(v: SpotTick | null) { this._spotRaw.set(v); }
  @Input() set rfqResponse(v: RfqResponse | null) { this._rfqResp.set(v ?? { status: 'idle' }); }

  @Output() readonly submit = new EventEmitter<Record<string, unknown>>();
  @Output() readonly rfqRequest = new EventEmitter<Record<string, unknown>>();
  @Output() readonly rfqAccept = new EventEmitter<Record<string, unknown>>();
  @Output() readonly rfqReject = new EventEmitter<void>();
  @Output() readonly paramsChanged = new EventEmitter<Record<string, unknown>>();

  readonly pairs = PAIRS;
  pair = 'USDPLN';
  side: 'BUY' | 'SELL' = 'SELL';
  amount = 100_000;
  valueDate = '';
  marginPips = 50;

  readonly limitDisplay = LIMIT_AMOUNT.toLocaleString('pl-PL');
  readonly requestTimeoutSec = REQUEST_TIMEOUT_SEC;

  readonly bookingPhase = signal<'idle' | 'booking' | 'success' | 'error'>('idle');
  readonly bookingError = signal<string>('');
  readonly lastBooking = signal<Record<string, unknown> | null>(null);

  private readonly _spotRaw = signal<SpotTick | null>(null);
  private readonly _rfqResp = signal<RfqResponse>({ status: 'idle' });
  private readonly _rfqMode = signal(false);
  private _acceptTimer: ReturnType<typeof setInterval> | null = null;
  private _pendingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly _rfqTtl = signal(0);
  private readonly _pendingTtl = signal(0);
  private _pendingDeadline = 0;
  private _acceptDeadline = 0;

  readonly rfqMode = this._rfqMode.asReadonly();
  readonly rfqStatus = computed(() => this._rfqResp().status);
  readonly rfqPrice = computed(() => this._rfqResp().price ?? null);
  readonly rfqTtl = this._rfqTtl.asReadonly();
  readonly pendingTtl = this._pendingTtl.asReadonly();

  readonly pendingProgress = computed(() => {
    const remaining = this._pendingTtl();
    return Math.max(0, (remaining / REQUEST_TIMEOUT_SEC) * 100);
  });

  readonly acceptProgress = computed(() => {
    const remaining = this._rfqTtl();
    return Math.max(0, (remaining / ACCEPT_TIMEOUT_SEC) * 100);
  });

  readonly spotBid = computed(() => {
    const s = this._spotRaw();
    return s?.bid?.toFixed(5) ?? '—';
  });
  readonly spotAsk = computed(() => {
    const s = this._spotRaw();
    return s?.ask?.toFixed(5) ?? '—';
  });

  readonly txRate = computed<number | null>(() => {
    if (this._rfqMode()) {
      const resp = this._rfqResp();
      return resp.status === 'price-received' ? (resp.price ?? null) : null;
    }
    const s = this._spotRaw();
    if (!s?.bid || !s?.ask) return null;
    const base = this.side === 'BUY' ? s.ask : s.bid;
    const margin = this.marginPips * 0.0001;
    return +(base + (this.side === 'BUY' ? margin : -margin)).toFixed(5);
  });

  readonly profitPln = computed<number | null>(() => {
    const rate = this.txRate();
    if (rate === null) return null;
    return +((this.amount * this.marginPips * 0.0001)).toFixed(2);
  });

  readonly dealType = computed<string>(() => {
    if (!this.valueDate) return '—';
    const today = new Date();
    const vd = new Date(this.valueDate);
    const diff = Math.round((vd.getTime() - today.getTime()) / 86400000);
    if (diff <= 0) return 'TODAY';
    if (diff === 1) return 'TOM';
    if (diff === 2) return 'SPOT';
    return 'FWD';
  });

  constructor() {
    effect(() => {
      const resp = this._rfqResp();
      if (resp.status === 'price-received' && resp.validUntil) {
        this.startAcceptCountdown(resp.validUntil);
      }
    });
  }

  onParamsChange(): void {
    this.paramsChanged.emit(this.buildPayload());
  }

  onAmountChange(): void {
    const wasRfq = this._rfqMode();
    const isOverLimit = this.amount > LIMIT_AMOUNT;

    if (isOverLimit && !wasRfq) {
      this._rfqMode.set(true);
      this._rfqResp.set({ status: 'idle' });
    } else if (!isOverLimit && wasRfq) {
      this._rfqMode.set(false);
      this._rfqResp.set({ status: 'idle' });
      this.clearAllTimers();
    }
    this.onParamsChange();
  }

  canSubmit(): boolean {
    return this.clientCode !== '' && this.amount >= 1 && this._spotRaw() !== null && this.txRate() !== null;
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;
    this.bookDeal(this.buildPayload());
  }

  sendRfq(): void {
    this._rfqResp.set({ status: 'pending' });
    this.rfqRequest.emit(this.buildPayload());
    this.startPendingCountdown();

    // SYMULACJA: po 2-5s serwer odpowiada ceną (w produkcji — handler łapie event i robi fetch)
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      if (this._rfqResp().status !== 'pending') return;
      const s = this._spotRaw();
      const base = s ? (this.side === 'BUY' ? (s.ask ?? 4.05) : (s.bid ?? 4.05)) : (PAIR_MIDS[this.pair] ?? 4.05);
      const margin = this.marginPips * 0.0001;
      const price = +(base + (this.side === 'BUY' ? margin : -margin)).toFixed(5);
      this.clearPendingTimer();
      this._rfqResp.set({
        status: 'price-received',
        price,
        refRate: +base.toFixed(5),
        validUntil: Date.now() + ACCEPT_TIMEOUT_SEC * 1000,
      });
    }, delay);
  }

  acceptRfq(): void {
    this.clearAllTimers();
    this._rfqResp.update((r) => ({ ...r, status: 'accepted' }));
    this.bookDeal({ ...this.buildPayload(), rfqPrice: this.rfqPrice() });
  }

  rejectRfq(): void {
    this.clearAllTimers();
    this._rfqResp.set({ status: 'rejected' });
    this.rfqReject.emit();
  }

  onCancel(): void {
    this._rfqMode.set(false);
    this._rfqResp.set({ status: 'idle' });
    this.clearAllTimers();
    this.amount = 100_000;
    this.onParamsChange();
  }

  private bookDeal(payload: Record<string, unknown>): void {
    this.bookingPhase.set('booking');
    this.clearAllTimers();

    // SYMULACJA: 1-2s booking delay. ~85% success, ~15% error.
    // W produkcji: fetch(transaction.book, payload) → onSuccess/onError.
    const delay = 1000 + Math.random() * 1500;
    const willFail = Math.random() < 0.15;

    setTimeout(() => {
      if (willFail) {
        this.bookingPhase.set('error');
        this.bookingError.set('Limit intraday przekroczony dla tego klienta. Skontaktuj się z Risk Management (ERR-4021).');
      } else {
        const ref = `FX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        this.lastBooking.set({ ...payload, bookingRef: ref, bookedAt: new Date().toISOString() });
        this.bookingPhase.set('success');
        this.submit.emit({ ...payload, bookingRef: ref });
      }
    }, delay);
  }

  newDeal(): void {
    this.bookingPhase.set('idle');
    this.lastBooking.set(null);
    this._rfqMode.set(false);
    this._rfqResp.set({ status: 'idle' });
    this.amount = 100_000;
    this.marginPips = 50;
    this.side = 'SELL';
    this.valueDate = '';
    this.onParamsChange();
  }

  retryFromError(): void {
    this.bookingPhase.set('idle');
    this.bookingError.set('');
    if (this._rfqMode()) {
      this._rfqResp.set({ status: 'idle' });
    }
  }

  private buildPayload(): Record<string, unknown> {
    return {
      client: this.clientCode,
      clientName: this.clientName,
      pair: this.pair,
      side: this.side,
      amount: this.amount,
      valueDate: this.valueDate,
      marginPips: this.marginPips,
      txRate: this.txRate(),
      profitPln: this.profitPln(),
      dealType: this.dealType(),
    };
  }

  private startPendingCountdown(): void {
    this.clearPendingTimer();
    this._pendingDeadline = Date.now() + REQUEST_TIMEOUT_SEC * 1000;
    const tick = (): void => {
      const remaining = Math.max(0, Math.round((this._pendingDeadline - Date.now()) / 1000));
      this._pendingTtl.set(remaining);
      if (remaining <= 0) {
        this.clearPendingTimer();
        if (this._rfqResp().status === 'pending') {
          this._rfqResp.set({ status: 'timeout' });
        }
      }
    };
    tick();
    this._pendingTimer = setInterval(tick, 250);
  }

  private startAcceptCountdown(validUntil: number): void {
    this.clearAcceptTimer();
    this._acceptDeadline = validUntil;
    const tick = (): void => {
      const remaining = Math.max(0, Math.round((this._acceptDeadline - Date.now()) / 1000));
      this._rfqTtl.set(remaining);
      if (remaining <= 0) {
        this.clearAcceptTimer();
        if (this._rfqResp().status === 'price-received') {
          this._rfqResp.set({ status: 'expired' });
        }
      }
    };
    tick();
    this._acceptTimer = setInterval(tick, 250);
  }

  private clearPendingTimer(): void {
    if (this._pendingTimer !== null) { clearInterval(this._pendingTimer); this._pendingTimer = null; }
  }

  private clearAcceptTimer(): void {
    if (this._acceptTimer !== null) { clearInterval(this._acceptTimer); this._acceptTimer = null; }
  }

  private clearAllTimers(): void {
    this.clearPendingTimer();
    this.clearAcceptTimer();
  }
}
