import type { PageConfig, WidgetConfig, EventHandlerConfig, DatasourceConfig } from '@echelon-framework/core';

export type FlowNodeKind = 'datasource' | 'widget' | 'computed' | 'handler' | 'lifecycle';

export interface FlowNode {
  readonly id: string;
  readonly kind: FlowNodeKind;
  readonly label: string;
  readonly subtitle?: string;
  readonly meta?: Readonly<Record<string, string | number | boolean>>;
}

export type FlowEdgeKind = 'bind' | 'computed-dep' | 'event-emit' | 'event-listen' | 'action' | 'lifecycle';

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: FlowEdgeKind;
  readonly label?: string;
}

export interface FlowGraph {
  readonly pageId: string;
  readonly title: string;
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly edges: ReadonlyArray<FlowEdge>;
}

/**
 * Ekstraktor grafu z zres olvowanego `PageConfig`. Produkuje węzły dla
 * datasources, widgetów, computed i handlerów, oraz krawędzie reprezentujące
 * bindingi ($ds.xxx), zależności computed, emit/listen, action calls.
 *
 * Wynik jest deterministyczny — służy jako wejście do dowolnego renderera
 * (mermaid, DOT, React Flow, JSON, HTML overlay).
 */
export function buildFlowGraph(config: PageConfig): FlowGraph {
  const page = config.page;
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();

  const register = (node: FlowNode): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };

  // Datasources
  const datasources = page.datasources ?? {};
  for (const [id, ds] of Object.entries(datasources)) {
    register({ id: dsId(id), kind: 'datasource', label: id, subtitle: datasourceSubtitle(ds) });
  }

  // Computed
  const computed = page.computed ?? {};
  for (const [id, spec] of Object.entries(computed)) {
    const nodeId = computedId(id);
    register({ id: nodeId, kind: 'computed', label: id, subtitle: spec.expr });
    for (const dep of spec.deps) {
      const ref = resolveRef(dep);
      if (ref) edges.push({ from: ref, to: nodeId, kind: 'computed-dep' });
    }
  }

  // Widgets
  for (const [id, widget] of Object.entries(page.widgets)) {
    register({ id: widgetId(id), kind: 'widget', label: id, subtitle: widget.type });
    collectBindEdges(edges, widget, id);
    collectWidgetActions(edges, widget, id);
  }

  // Event handlers
  for (const [index, handler] of (page.eventHandlers ?? []).entries()) {
    const hid = handlerId(index, handler.on);
    register({ id: hid, kind: 'handler', label: handler.on, subtitle: handlerSubtitle(handler) });
    edges.push({ from: hid, to: hid, kind: 'event-listen', label: handler.on });
    for (const action of handler.do) {
      applyAction(edges, action, hid);
    }
  }

  // Lifecycle
  const lifecycle = page.lifecycle ?? {};
  for (const [phase, actions] of Object.entries(lifecycle)) {
    if (!actions) continue;
    const lid = lifecycleId(phase);
    register({ id: lid, kind: 'lifecycle', label: phase, subtitle: 'lifecycle' });
    for (const action of actions) {
      applyAction(edges, action, lid);
    }
  }

  return {
    pageId: page.id,
    title: page.title,
    nodes,
    edges: deduplicateEdges(edges),
  };
}

function dsId(id: string): string {
  return `ds:${id}`;
}
function widgetId(id: string): string {
  return `w:${id}`;
}
function computedId(id: string): string {
  return `cp:${id}`;
}
function handlerId(index: number, on: string): string {
  return `h:${index}:${on}`;
}
function lifecycleId(phase: string): string {
  return `lc:${phase}`;
}

function datasourceSubtitle(ds: DatasourceConfig): string {
  const kind = ds.kind ?? 'transport';
  if (kind === 'transport') return `${kind}: ${ds.transport ?? '—'}${ds.endpoint ? ' ' + ds.endpoint : ''}`;
  if (kind === 'computed') return `computed: ${ds.fn ?? '—'}`;
  if (kind === 'local') return 'local';
  return kind;
}

function handlerSubtitle(handler: EventHandlerConfig): string {
  const actions = handler.do.map(describeAction);
  return actions.join(' → ');
}

function describeAction(action: unknown): string {
  const a = action as Record<string, unknown>;
  if ('call' in a) return `call(${String(a['call'])})`;
  if ('emit' in a) return `emit(${String(a['emit'])})`;
  if ('setDatasource' in a) return `set(${String(a['setDatasource'])})`;
  if ('clearDatasource' in a) return `clear(${String(a['clearDatasource'])})`;
  return 'action';
}

function collectBindEdges(edges: FlowEdge[], widget: WidgetConfig, id: string): void {
  const binds = widget.bind ?? {};
  for (const [prop, expr] of Object.entries(binds)) {
    const ref = resolveRef(expr);
    if (ref) edges.push({ from: ref, to: widgetId(id), kind: 'bind', label: prop });
  }
}

function collectWidgetActions(edges: FlowEdge[], widget: WidgetConfig, id: string): void {
  for (const action of widget.actions ?? []) {
    if (action.emit) {
      edges.push({ from: widgetId(id), to: `evt:${action.emit.event}`, kind: 'event-emit', label: action.id });
    }
  }
}

function applyAction(edges: FlowEdge[], action: unknown, fromId: string): void {
  const a = action as Record<string, unknown>;
  if ('emit' in a && typeof a['emit'] === 'string') {
    edges.push({ from: fromId, to: `evt:${a['emit']}`, kind: 'event-emit' });
    return;
  }
  if ('setDatasource' in a && typeof a['setDatasource'] === 'string') {
    edges.push({ from: fromId, to: dsId(a['setDatasource']), kind: 'action', label: 'setDatasource' });
    return;
  }
  if ('clearDatasource' in a && typeof a['clearDatasource'] === 'string') {
    edges.push({ from: fromId, to: dsId(a['clearDatasource']), kind: 'action', label: 'clearDatasource' });
    return;
  }
  if ('call' in a && typeof a['call'] === 'string') {
    edges.push({ from: fromId, to: `fn:${a['call']}`, kind: 'action', label: 'call' });
  }
}

/**
 * Rozwiązuje odniesienie w bindingu / dependency. Obsługuje:
 *   $ds.foo, $computed.bar, $local.baz, $session.role, $event.value
 * Zwraca node-id do istniejącego zasobu, lub null jeśli brak powiązania.
 */
function resolveRef(expr: string): string | null {
  if (typeof expr !== 'string') return null;
  const trimmed = expr.trim();
  const match = /^\$(\w+)\.([\w.[\]]+)/.exec(trimmed);
  if (!match) {
    if (/^[\w]+$/.test(trimmed)) return dsId(trimmed);
    return null;
  }
  const [, prefix, rest] = match;
  const head = rest?.split(/[.[]/)[0] ?? '';
  if (!head) return null;
  if (prefix === 'ds') return dsId(head);
  if (prefix === 'computed') return computedId(head);
  if (prefix === 'local') return dsId(head);
  return null;
}

function deduplicateEdges(edges: FlowEdge[]): FlowEdge[] {
  const seen = new Set<string>();
  const out: FlowEdge[] = [];
  for (const e of edges) {
    const key = `${e.from}|${e.to}|${e.kind}|${e.label ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
