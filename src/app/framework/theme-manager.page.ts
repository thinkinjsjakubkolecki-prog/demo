import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/designer/themes',
  title: 'Theme Manager',
})
export class ThemeManagerPage {
  static readonly config = PageBuilder.create('theme-manager')
    .title('Theme Manager')
    .widget('themes', { x: 0, y: 0, w: 12, h: 12 }, widget.any('theme-manager', {}))
    .build();
}
