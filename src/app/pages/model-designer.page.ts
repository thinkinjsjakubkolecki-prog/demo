import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer/models',
  title: 'Model Designer',
})
export class ModelDesignerPage {
  static readonly config = PageBuilder.create('model-designer')
    .title('Model Designer')
    .widget('model-designer', { x: 0, y: 0, w: 12, h: 12 }, widget.any('model-designer', {}))
    .build();
}
