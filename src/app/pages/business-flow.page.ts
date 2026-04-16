/**
 * Business Flow — realne biznesowe przebiegi dealer-fx-app.
 *
 * Pokazuje jak biznesowe kroki (Klient/Dealer/System/Compliance) mapują się
 * na konkretne widgety, eventy, handlery i funkcje w kodzie. Każdy krok ma
 * status (✓/⚠/✗), instrukcję "co kliknąć" i link do pliku źródłowego.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/business-flow',
  title: 'Business Flow',
})
export class BusinessFlowPage {
  static readonly config = PageBuilder.create('business-flow')
    .title('Business Flow — realne procesy aplikacji')
    .widget('title', { x: 0, y: 0, w: 12 }, widget.any('page-title', {
      options: {
        title: 'Business Flow — realne procesy',
        subtitle: 'RFQ · Position Close · CSV Export — z linkami do kodu i instrukcją „co kliknąć żeby to zobaczyć"',
      },
    }))
    .widget('flow', { x: 0, y: 1, w: 12, h: 10 }, widget.any('business-flow', {}))
    .build();
}
