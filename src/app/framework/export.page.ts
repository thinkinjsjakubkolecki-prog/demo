import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer/export',
  title: 'Export Bundle',
})
export class ExportPage {
  static readonly config = PageBuilder.create('export-panel')
    .title('Export Designer Bundle')
    .widget('export', { x: 0, y: 0, w: 12, h: 12 }, widget.any('export-panel', {}))
    .build();
}
