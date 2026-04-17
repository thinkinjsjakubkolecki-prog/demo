/**
 * Designer — Page Inspector dla Echelon.
 *
 * Faza 1 z VISUAL_DESIGNER_ROADMAP.md — read-only widok struktury każdej
 * zarejestrowanej strony z mapowaniem na kod, bez edycji.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer',
  title: 'Page Inspector',
})
export class DesignerPage {
  static readonly config = PageBuilder.create('designer')
    .title('Page Inspector (Faza 1 — read-only)')
    .widget('shell', { x: 0, y: 0, w: 12, h: 12 }, widget.any('designer-shell', {}))
    .build();
}
