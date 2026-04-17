import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer/translations',
  title: 'Translation Manager',
})
export class TranslationManagerPage {
  static readonly config = PageBuilder.create('translation-manager')
    .title('Translation Manager')
    .widget('i18n', { x: 0, y: 0, w: 12, h: 12 }, widget.any('translation-manager', {}))
    .build();
}
