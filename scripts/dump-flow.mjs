/**
 * Eksportuje PageConfig wybranej strony do JSON i renderuje jako mermaid flow.
 *
 * Użycie:
 *   node scripts/dump-flow.mjs positions    # → positions.flow.mermaid
 *   node scripts/dump-flow.mjs quote --json # → quote.flow.json + mermaid
 *
 * Output: tekst mermaid na stdout + zapis do `./out/<id>.flow.mermaid`.
 * Wklej do https://mermaid.live lub otwórz w VS Code z Markdown Preview Mermaid.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Używamy tsx żeby uruchomić TS pages bez kompilacji. Fallback — jeśli tsx nie ma,
// instrukcja jak go doinstalować.
try {
  register('tsx/esm', pathToFileURL('./'));
} catch {
  console.error('ERROR: tsx nie jest zainstalowany. Zainstaluj: npm i -D tsx');
  console.error('Albo uruchom przez: npx tsx scripts/dump-flow.mjs <page>');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const [pageName = 'positions', ...flags] = process.argv.slice(2);
const saveJson = flags.includes('--json');
const direction = (flags.find((f) => f.startsWith('--direction='))?.split('=')[1]) ?? 'LR';

const pagePath = resolve(ROOT, `src/app/pages/${pageName}.page.ts`);
if (!existsSync(pagePath)) {
  console.error(`Nie znaleziono ${pagePath}`);
  console.error('Dostępne strony:');
  for (const p of ['dashboard', 'positions', 'quote', 'clients', 'clients-admin', 'client-profile', 'client-fx', 'new-transaction']) {
    if (existsSync(resolve(ROOT, `src/app/pages/${p}.page.ts`))) console.error(`  ${p}`);
  }
  process.exit(2);
}

// Dynamic import TS page — tsx handler transpiluje w locie.
const pageModule = await import(pathToFileURL(pagePath).href);
const PageClass = Object.values(pageModule).find((v) => v && typeof v === 'function' && 'config' in v);
if (!PageClass) {
  console.error(`Nie znaleziono klasy Page w ${pagePath} — sprawdź czy @Page({...}) jest wyeksportowany.`);
  process.exit(3);
}
const config = PageClass.config;

// Generowanie FlowGraph + mermaid.
const { buildFlowGraph, toMermaid } = await import('@echelon-framework/designer-core');
const graph = buildFlowGraph(config);
const mermaid = toMermaid(graph, { direction, includeSubtitle: true });

const outDir = resolve(ROOT, 'out');
if (!existsSync(outDir)) mkdirSync(outDir);

const mmdPath = resolve(outDir, `${pageName}.flow.mermaid`);
writeFileSync(mmdPath, mermaid);

if (saveJson) {
  const jsonPath = resolve(outDir, `${pageName}.flow.json`);
  writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
  console.error(`JSON:    ${jsonPath}`);
}

console.error(`Nodes:   ${graph.nodes.length}`);
console.error(`Edges:   ${graph.edges.length}`);
console.error(`Mermaid: ${mmdPath}`);
console.error(`---`);
console.log(mermaid);
