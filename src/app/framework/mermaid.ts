import type { FlowEdge, FlowGraph, FlowNode, FlowNodeKind } from './graph';

export interface MermaidExportOptions {
  readonly direction?: 'LR' | 'TD' | 'BT' | 'RL';
  readonly includeSubtitle?: boolean;
}

/**
 * Eksportuje `FlowGraph` do tekstu mermaid flowchart — gotowego do wklejenia
 * do README, wyrenderowania w mermaid.live, VS Code preview albo w JS
 * runtime (mermaid.initialize + mermaid.render).
 */
export function toMermaid(graph: FlowGraph, options: MermaidExportOptions = {}): string {
  const direction = options.direction ?? 'LR';
  const includeSubtitle = options.includeSubtitle ?? true;
  const lines: string[] = [`flowchart ${direction}`, `%% page: ${graph.pageId} — ${graph.title}`];

  for (const node of graph.nodes) {
    lines.push('  ' + renderNode(node, includeSubtitle));
  }

  for (const edge of graph.edges) {
    lines.push('  ' + renderEdge(edge));
  }

  const classes = new Map<FlowNodeKind, string[]>();
  for (const node of graph.nodes) {
    if (!classes.has(node.kind)) classes.set(node.kind, []);
    classes.get(node.kind)!.push(safeId(node.id));
  }
  for (const [kind, ids] of classes) {
    lines.push(`  classDef ${kind} ${STYLE[kind]}`);
    lines.push(`  class ${ids.join(',')} ${kind}`);
  }

  return lines.join('\n');
}

function renderNode(node: FlowNode, includeSubtitle: boolean): string {
  const id = safeId(node.id);
  const label = includeSubtitle && node.subtitle ? `${escape(node.label)}<br/><small>${escape(node.subtitle)}</small>` : escape(node.label);
  const open = SHAPE[node.kind]?.[0] ?? '[';
  const close = SHAPE[node.kind]?.[1] ?? ']';
  return `${id}${open}"${label}"${close}`;
}

function renderEdge(edge: FlowEdge): string {
  const from = safeId(edge.from);
  const to = safeId(edge.to);
  const style = EDGE_STYLE[edge.kind];
  if (edge.label) return `${from} ${style}|${escape(edge.label)}| ${to}`;
  return `${from} ${style} ${to}`;
}

function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, '_');
}

function escape(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

const SHAPE: Readonly<Record<FlowNodeKind, [string, string]>> = {
  datasource: ['[(', ')]'],
  widget: ['[', ']'],
  computed: ['>', ']'],
  handler: ['{{', '}}'],
  lifecycle: ['((', '))'],
};

const EDGE_STYLE: Readonly<Record<FlowEdge['kind'], string>> = {
  bind: '-->',
  'computed-dep': '-.->',
  'event-emit': '==>',
  'event-listen': '-.->',
  action: '-->',
  lifecycle: '==>',
};

const STYLE: Readonly<Record<FlowNodeKind, string>> = {
  datasource: 'fill:#1e3a5f,stroke:#3b82f6,color:#e0f2fe',
  widget: 'fill:#374151,stroke:#9ca3af,color:#f3f4f6',
  computed: 'fill:#713f12,stroke:#f59e0b,color:#fef3c7',
  handler: 'fill:#5b21b6,stroke:#a78bfa,color:#ede9fe',
  lifecycle: 'fill:#064e3b,stroke:#34d399,color:#d1fae5',
};
