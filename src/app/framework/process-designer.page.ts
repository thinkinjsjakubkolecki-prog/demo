import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer/processes',
  title: 'Process Designer',
})
export class ProcessDesignerPage {
  static readonly config = PageBuilder.create('process-designer')
    .title('Process Designer')
    .widget('process-designer', { x: 0, y: 0, w: 12, h: 12 }, widget.any('process-designer', {}))
    .build();
}
