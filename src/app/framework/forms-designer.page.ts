/**
 * Forms Designer — dedykowana sekcja designera dla formularzy.
 *
 * Część podziału designera na 3 sekcje (DESIGNER_SECTIONS_PLAN.md):
 *   /designer              → Pages Designer (strony, layout, widgets)
 *   /designer/datasources  → Data Sources Designer (M30/M31)
 *   /designer/forms        → Forms Designer (THIS)  ← M34/M35
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer/forms',
  title: 'Forms Designer',
})
export class FormsDesignerPage {
  static readonly config = PageBuilder.create('forms-designer')
    .title('Forms Designer')
    .widget('form-designer', { x: 0, y: 0, w: 12, h: 12 }, widget.any('form-designer', {}))
    .build();
}
