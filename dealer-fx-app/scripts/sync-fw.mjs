#!/usr/bin/env node
/**
 * sync-fw.mjs — kopiuje dist z lokalnych pakietów ng-engine do node_modules.
 * Uruchamiany przed `ng serve` żeby lokalne zmiany w frameworku były widoczne.
 */
import { cpSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root     = resolve(__dirname, '..');
const ngEngine = resolve(root, '../ng-engine/packages');
const nm       = resolve(root, 'node_modules/@echelon-framework');

const PACKAGES = [
  { name: 'widgets-core',    src: 'dist' },
  { name: 'runtime',         src: 'dist' },
  { name: 'page-builders',   src: 'dist' },
  { name: 'model',           src: 'dist' },
  { name: 'transport-mock',  src: 'dist' },
  { name: 'functions-core',  src: 'dist' },
];

for (const { name, src } of PACKAGES) {
  const from = resolve(ngEngine, name, src);
  const to   = resolve(nm, name, src);
  try {
    cpSync(from, to, { recursive: true, force: true });
    console.log(`✓ ${name}/${src}`);
  } catch (e) {
    console.warn(`✗ ${name}/${src}: ${e.message}`);
  }
}

// Wyczyść cache buildera żeby nie serwował starych modułów
try {
  rmSync(resolve(root, 'node_modules/.vite'), { recursive: true, force: true });
  console.log('✓ vite cache cleared');
} catch { /* ignoruj */ }
try {
  rmSync(resolve(root, '.angular/cache'), { recursive: true, force: true });
  console.log('✓ .angular/cache cleared');
} catch { /* ignoruj */ }
