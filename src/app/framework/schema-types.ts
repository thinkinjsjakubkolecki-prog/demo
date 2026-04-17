/**
 * Schema types — wspólny system typów dla datasources i formularzy.
 *
 * Jedno źródło prawdy:
 *   - DataSource deklaruje outputSchema (co produkuje)
 *   - DataSource deklaruje inputSchema (jakie params przyjmuje)
 *   - Formularz deklaruje inputContracts z expected schema (co konsumuje)
 *   - Designer waliduje: DS.outputSchema ⊇ Form.inputContract.schema
 *
 * Typy celowo proste (flat property map, nie JSON Schema) — renderable
 * w designer UI jako tabela, serializable do localStorage, walidowalne
 * w 30 linijkach.
 *
 * Docelowo migracja do @echelon-framework/core przy następnym bumpie.
 */

export type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'any';

export interface SchemaProperty {
  readonly type: PropertyType;
  readonly description?: string;
  readonly required?: boolean;
  /** Dla type:'object' — nested shape (max 1 level). */
  readonly properties?: Readonly<Record<string, SchemaPropertyLeaf>>;
  /** Dla type:'array' — typ elementu. */
  readonly itemType?: PropertyType;
  /** Dla type:'array' + itemType:'object' — shape elementu tablicy. */
  readonly itemProperties?: Readonly<Record<string, SchemaPropertyLeaf>>;
}

export type SchemaPropertyLeaf = Omit<SchemaProperty, 'properties' | 'itemProperties'>;

export type Schema = Readonly<Record<string, SchemaProperty>>;

// ─── Datasource contract ────────────────────────────────────────────────────

export type OutputCardinality = 'single' | 'array' | 'paginated';

export interface DatasourceContract {
  /** Co DS wymaga na wejściu (params do fetch/refresh). */
  readonly inputSchema?: Schema;
  /** Co DS produkuje na wyjściu (kształt wartości). */
  readonly outputSchema?: Schema;
  /** Model referencyjny output. */
  readonly outputModel?: string;
  /** Kardynalność output: single (Client), array (Client[]), paginated ({items: Client[], total}). */
  readonly outputCardinality?: OutputCardinality;
  /** Kiedy DS się odświeża (eventy, interwał). */
  readonly refreshOn?: ReadonlyArray<string>;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface SchemaValidationError {
  readonly property: string;
  readonly expected: PropertyType;
  readonly actual: string;
  readonly message: string;
}

/**
 * Structural subtype check: czy `provided` schema pokrywa `required` schema.
 * Zwraca błędy dla brakujących/niezgodnych pól.
 */
export function validateSchemaCompatibility(
  required: Schema,
  provided: Schema,
): ReadonlyArray<SchemaValidationError> {
  const errors: SchemaValidationError[] = [];
  for (const [prop, spec] of Object.entries(required)) {
    const provSpec = provided[prop];
    if (!provSpec) {
      if (spec.required) {
        errors.push({ property: prop, expected: spec.type, actual: 'missing', message: `Required property '${prop}' not in output schema` });
      }
      continue;
    }
    if (spec.type !== 'any' && provSpec.type !== 'any' && spec.type !== provSpec.type) {
      errors.push({ property: prop, expected: spec.type, actual: provSpec.type, message: `Property '${prop}': expected ${spec.type}, provided ${provSpec.type}` });
    }
  }
  return errors;
}

/**
 * Walidacja runtime snapshot vs schema.
 */
export function validateSnapshotAgainstSchema(
  schema: Schema,
  snapshot: unknown,
): ReadonlyArray<SchemaValidationError> {
  if (snapshot === undefined || snapshot === null) return [];
  if (typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
  const data = snapshot as Record<string, unknown>;
  const errors: SchemaValidationError[] = [];
  for (const [prop, spec] of Object.entries(schema)) {
    const value = data[prop];
    if (spec.required && (value === undefined || value === null)) {
      errors.push({ property: prop, expected: spec.type, actual: 'undefined', message: `Required '${prop}' missing` });
      continue;
    }
    if (value === undefined || value === null) continue;
    if (spec.type !== 'any' && !matchesType(value, spec.type)) {
      errors.push({ property: prop, expected: spec.type, actual: typeof value, message: `'${prop}' expected ${spec.type}, got ${typeof value}` });
    }
  }
  return errors;
}

function matchesType(value: unknown, expected: PropertyType): boolean {
  switch (expected) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'date': return typeof value === 'string' || value instanceof Date;
    case 'object': return typeof value === 'object' && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    case 'any': return true;
  }
}
