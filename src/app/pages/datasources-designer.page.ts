/**
 * Data Sources Designer — dedykowana sekcja designera dla datasources.
 *
 * Część podziału designera na 3 sekcje (DESIGNER_SECTIONS_PLAN.md):
 *   /designer              → Pages Designer (strony, layout, widgets)
 *   /designer/datasources  → Data Sources Designer (THIS)  ← M30
 *   /designer/forms        → Forms Designer (M34+)
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer/datasources',
  title: 'Data Sources Designer',
})
export class DatasourcesDesignerPage {
  static readonly config = PageBuilder.create('datasources-designer')
    .title('Data Sources Designer')
    .widget('ds-designer', { x: 0, y: 0, w: 12, h: 12 }, widget.any('datasource-designer', {}))
    .build();
}
