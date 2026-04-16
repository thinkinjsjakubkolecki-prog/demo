/** Quote (RFQ) — lewa lista klientów + środkowy formularz + prawy wynik.
 *
 * Integracje v0.2 rc.15:
 *   - i18n keys dla tytułów (`i18n:quote.*`) — resolved przez
 *     JsonDictionaryI18nService z framework-integrations.ts,
 *   - persistence: `draftQuote` local zapisywany przez
 *     DatasourcePersistenceManager (code-behind) w localStorage z 24h TTL,
 *   - feature flag `quote-form-v2` — 20% EU rollout; widget form renderuje
 *     alternatywny wariant options.variant='v2' gdy isFeatureFlagAllowed()
 *     zwróci true (sprawdzenie programowe w widget code).
 *
 * TODO rc.16: dodać pole `featureFlag` do widget.any() API żeby można było
 * to robić deklaratywnie w configu.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/quote',
  title: 'Quote',
})
export class QuotePage {
  static readonly config = PageBuilder.create('quote')
    .title('Quote')
    .ds('clientsList').ds('spotUsdPln')
    .local('selectedClient').local('quoteResult').local('draftQuote')
    .widget('title',  { x: 0, y: 0, w: 12 }, widget.any('page-title', {
      options: { title: 'i18n:quote.title', subtitle: 'i18n:quote.subtitle' },
    }))
    .widget('list',   { x: 0, y: 1, w: 5 },  widget.any('client-list', {
      bind: { clients: 'clientsList' },
    }))
    .widget('form',   { x: 5, y: 1, w: 4 },  widget.any('dealer-quote-form', {
      bind: { clientCode: 'selectedClient.code', spot: 'spotUsdPln', draft: 'draftQuote' },
      options: { requiresFlag: 'quote-form-v2', fallbackVariant: 'legacy', variant: 'v2' },
    }))
    .widget('result', { x: 9, y: 1, w: 3 },  widget.any('stat-tile', {
      bind: { value: 'quoteResult' },
      options: { label: 'Last quote rate', tone: 'accent' },
      when: { path: 'quoteResult', exists: true },
    }))
    .handler('list.select', [{ setDatasource: 'selectedClient', from: '$event' } as never])
    .handler('form.change', [
      { setDatasource: 'draftQuote', from: '$event' } as never,
    ])
    .handler('form.submit', [
      { callComputed: 'computeDealerRate', with: ['$event.spot', '$event.side', '$event.marginPips'], into: 'quoteResult' } as never,
      { clearDatasource: 'draftQuote' } as never,
    ])
    .build();
}
