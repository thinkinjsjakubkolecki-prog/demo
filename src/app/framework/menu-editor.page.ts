/**
 * Menu Editor — drzewo menu apki + linkowanie do zarejestrowanych stron +
 * eksport do `bootstrap/menu.ts`.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/menu-editor',
  title: 'Menu Editor',
})
export class MenuEditorPage {
  static readonly config = PageBuilder.create('menu-editor')
    .title('Menu Editor')
    .widget('editor', { x: 0, y: 0, w: 12, h: 12 }, widget.any('menu-editor', {}))
    .build();
}
