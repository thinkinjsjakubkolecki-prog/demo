/**
 * Export Bundle — eksportuje wszystkie drafty (modele, formularze, datasources,
 * strony) do formatu produkcyjnego.
 *
 * Dwa formaty:
 *   1. JSON bundle — runtime artifact, ładowany bez kompilacji
 *   2. TypeScript source — dev artifact, code review, git history
 *
 * Flow:
 *   DEV:  designery aktywne → localStorage drafty → edycja runtime
 *   EXPORT: klik "Export" → JSON + TS wygenerowane
 *   PROD: JSON bundle wczytany statycznie → zero designerów, zero edycji
 */
import { DraftModelStoreService } from './draft-model-store';
import { DraftFormStoreService } from './draft-form-store';
import { DraftDatasourceStoreService } from './draft-datasource-store';
import { DraftPageStoreService } from './draft-page-store';

export interface ExportBundle {
  readonly version: string;
  readonly exportedAt: string;
  readonly models: ReadonlyArray<unknown>;
  readonly forms: ReadonlyArray<unknown>;
  readonly datasources: ReadonlyArray<unknown>;
  readonly pages: ReadonlyArray<unknown>;
}

export function exportBundle(
  modelStore: DraftModelStoreService,
  formStore: DraftFormStoreService,
  dsStore: DraftDatasourceStoreService,
  pageStore: DraftPageStoreService,
): ExportBundle {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    models: modelStore.all().map((m) => ({ ...m })),
    forms: formStore.all().map((f) => ({ ...f })),
    datasources: dsStore.all().map((d) => ({ ...d })),
    pages: pageStore.all().map((p) => ({ ...p })),
  };
}

export function exportBundleAsJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function exportBundleAsTypeScript(bundle: ExportBundle): string {
  const lines: string[] = [
    '/**',
    ` * Echelon Designer Export — ${bundle.exportedAt}`,
    ` * Models: ${bundle.models.length}, Forms: ${bundle.forms.length}, DataSources: ${bundle.datasources.length}, Pages: ${bundle.pages.length}`,
    ' *',
    ' * Wygenerowane przez Designer Export. NIE edytuj ręcznie.',
    ' * Żeby zmienić — edytuj w designerze i eksportuj ponownie.',
    ' */',
    '',
  ];

  if (bundle.models.length > 0) {
    lines.push('// ─── Models ─────────────────────────────────────────────────────────────');
    for (const m of bundle.models as Array<{ id: string; title: string; fields: Array<{ id: string; type: string; required?: boolean; ref?: { modelId: string; kind: string } }> }>) {
      lines.push(`export interface ${m.id} {`);
      for (const f of m.fields) {
        const opt = f.required ? '' : '?';
        const type = f.ref ? (f.ref.kind.includes('N') ? `${f.ref.modelId}[]` : f.ref.modelId) : f.type;
        lines.push(`  ${f.id}${opt}: ${type};`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  if (bundle.forms.length > 0) {
    lines.push('// ─── Forms ──────────────────────────────────────────────────────────────');
    lines.push(`import { PageBuilder, widget } from '@echelon-framework/page-builders';`);
    lines.push('');
    for (const f of bundle.forms as Array<{ id: string; title: string; fields: unknown[]; inputContracts?: unknown[]; emits?: unknown[]; submitLabel?: string }>) {
      lines.push(`export const ${camelCase(f.id)}FormConfig = {`);
      lines.push(`  id: '${f.id}',`);
      lines.push(`  title: '${f.title}',`);
      lines.push(`  submitLabel: '${f.submitLabel ?? 'Zapisz'}',`);
      lines.push(`  fields: ${JSON.stringify(f.fields, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
      if (f.inputContracts && f.inputContracts.length > 0) {
        lines.push(`  inputContracts: ${JSON.stringify(f.inputContracts, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
      }
      if (f.emits && f.emits.length > 0) {
        lines.push(`  emits: ${JSON.stringify(f.emits, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`);
      }
      lines.push(`} as const;`);
      lines.push('');
    }
  }

  if (bundle.datasources.length > 0) {
    lines.push('// ─── DataSources ────────────────────────────────────────────────────────');
    for (const d of bundle.datasources as Array<{ id: string; title: string; kind: string; transport?: string; endpoint?: string; contract: unknown }>) {
      lines.push(`export const ${camelCase(d.id)}DsConfig = ${JSON.stringify(d, null, 2)} as const;`);
      lines.push('');
    }
  }

  if (bundle.pages.length > 0) {
    lines.push('// ─── Pages ──────────────────────────────────────────────────────────────');
    for (const p of bundle.pages as Array<{ id: string; title: string; config: unknown }>) {
      lines.push(`export const ${camelCase(p.id)}PageConfig = ${JSON.stringify(p.config, null, 2)} as const;`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function camelCase(s: string): string {
  return s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}
