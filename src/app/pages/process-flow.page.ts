/**
 * Process Flow Designer — demo Echelon designer-core w live appce.
 *
 * Strona pokazuje FlowGraph dowolnej strony aplikacji jako mermaid diagram
 * (BPMN-like). Służy jako learning/audit tool — dealer / BA / compliance
 * widzą co się dzieje w kodzie bez czytania TypeScripta.
 */
import { Page, PageBuilder, widget } from '@echelon-framework/page-builders';

@Page({
  route: '/process-flow',
  title: 'Process Flow',
})
export class ProcessFlowPage {
  static readonly config = PageBuilder.create('process-flow')
    .title('Process Flow Designer')
    .widget('title', { x: 0, y: 0, w: 12 }, widget.any('page-title', {
      options: {
        title: 'Process Flow Designer',
        subtitle: 'Live FlowGraph każdej strony — datasource/widget/computed/handler/lifecycle',
      },
    }))
    .widget('diagram', { x: 0, y: 1, w: 12, h: 10 }, widget.any('flow-diagram', {}))
    .build();
}
