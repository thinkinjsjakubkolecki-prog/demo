/**
 * Predefiniowane CSS temy frameworka.
 *
 * Każda tema = zestaw CSS custom properties. Apka wybiera temę,
 * framework aplikuje variablesy na :root. Wszystkie komponenty
 * designera i widgety używają tych samych zmiennych.
 *
 * Struktura:
 *   --ech-bg, --ech-fg, --ech-accent, --ech-border, --ech-panel, --ech-muted
 *   --ech-font-family, --ech-font-size, --ech-radius, --ech-spacing
 *   --ech-success, --ech-warning, --ech-danger, --ech-info
 */

export interface CssTheme {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: 'dark' | 'light' | 'contrast' | 'custom';
  readonly preview: string;
  readonly variables: Readonly<Record<string, string>>;
}

export const BUILT_IN_THEMES: ReadonlyArray<CssTheme> = [
  {
    id: 'dark-default',
    name: 'Dark Default',
    description: 'Ciemna tema bazowa Echelon — niebieskie akcenty, szary panel.',
    category: 'dark',
    preview: '#0f172a',
    variables: {
      '--ech-bg': '#0b1120',
      '--ech-fg': '#e5e7eb',
      '--ech-muted': '#9ca3af',
      '--ech-accent': '#58a6ff',
      '--ech-border': '#1f2937',
      '--ech-panel': '#0f172a',
      '--ech-panel-alt': '#111827',
      '--ech-success': '#10b981',
      '--ech-warning': '#f59e0b',
      '--ech-danger': '#ef4444',
      '--ech-info': '#3b82f6',
      '--ech-font-family': 'Inter, system-ui, -apple-system, sans-serif',
      '--ech-font-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      '--ech-font-size': '13px',
      '--ech-radius': '6px',
      '--ech-radius-sm': '3px',
      '--ech-spacing': '16px',
      '--ech-spacing-sm': '8px',
      '--ech-spacing-xs': '4px',
      '--ech-shadow': '0 1px 3px rgba(0,0,0,0.3)',
      '--ech-transition': '0.15s ease',
    },
  },
  {
    id: 'dark-midnight',
    name: 'Dark Midnight',
    description: 'Głęboki granat z fioletowymi akcentami.',
    category: 'dark',
    preview: '#0a0e1a',
    variables: {
      '--ech-bg': '#0a0e1a',
      '--ech-fg': '#e2e8f0',
      '--ech-muted': '#94a3b8',
      '--ech-accent': '#a78bfa',
      '--ech-border': '#1e293b',
      '--ech-panel': '#0f1629',
      '--ech-panel-alt': '#131b2e',
      '--ech-success': '#34d399',
      '--ech-warning': '#fbbf24',
      '--ech-danger': '#f87171',
      '--ech-info': '#818cf8',
      '--ech-font-family': 'Inter, system-ui, sans-serif',
      '--ech-font-mono': 'JetBrains Mono, ui-monospace, monospace',
      '--ech-font-size': '13px',
      '--ech-radius': '8px',
      '--ech-radius-sm': '4px',
      '--ech-spacing': '16px',
      '--ech-spacing-sm': '8px',
      '--ech-spacing-xs': '4px',
      '--ech-shadow': '0 2px 8px rgba(0,0,0,0.4)',
      '--ech-transition': '0.2s ease',
    },
  },
  {
    id: 'light-clean',
    name: 'Light Clean',
    description: 'Jasna tema — biały tło, szare panele, niebieski akcent.',
    category: 'light',
    preview: '#ffffff',
    variables: {
      '--ech-bg': '#ffffff',
      '--ech-fg': '#1f2937',
      '--ech-muted': '#6b7280',
      '--ech-accent': '#2563eb',
      '--ech-border': '#e5e7eb',
      '--ech-panel': '#ffffff',
      '--ech-panel-alt': '#f9fafb',
      '--ech-success': '#059669',
      '--ech-warning': '#d97706',
      '--ech-danger': '#dc2626',
      '--ech-info': '#2563eb',
      '--ech-font-family': 'Inter, system-ui, sans-serif',
      '--ech-font-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      '--ech-font-size': '14px',
      '--ech-radius': '6px',
      '--ech-radius-sm': '4px',
      '--ech-spacing': '16px',
      '--ech-spacing-sm': '8px',
      '--ech-spacing-xs': '4px',
      '--ech-shadow': '0 1px 3px rgba(0,0,0,0.1)',
      '--ech-transition': '0.15s ease',
    },
  },
  {
    id: 'light-corporate',
    name: 'Light Corporate',
    description: 'Profesjonalna jasna tema — teal akcenty, kompaktowa.',
    category: 'light',
    preview: '#f8fafc',
    variables: {
      '--ech-bg': '#f8fafc',
      '--ech-fg': '#0f172a',
      '--ech-muted': '#64748b',
      '--ech-accent': '#0d9488',
      '--ech-border': '#e2e8f0',
      '--ech-panel': '#ffffff',
      '--ech-panel-alt': '#f1f5f9',
      '--ech-success': '#0d9488',
      '--ech-warning': '#ea580c',
      '--ech-danger': '#e11d48',
      '--ech-info': '#0284c7',
      '--ech-font-family': '"IBM Plex Sans", system-ui, sans-serif',
      '--ech-font-mono': '"IBM Plex Mono", ui-monospace, monospace',
      '--ech-font-size': '13px',
      '--ech-radius': '4px',
      '--ech-radius-sm': '2px',
      '--ech-spacing': '14px',
      '--ech-spacing-sm': '7px',
      '--ech-spacing-xs': '3px',
      '--ech-shadow': '0 1px 2px rgba(0,0,0,0.05)',
      '--ech-transition': '0.1s ease',
    },
  },
  {
    id: 'contrast-high',
    name: 'High Contrast',
    description: 'Wysoki kontrast — WCAG AAA, czarny + biały + żółty.',
    category: 'contrast',
    preview: '#000000',
    variables: {
      '--ech-bg': '#000000',
      '--ech-fg': '#ffffff',
      '--ech-muted': '#d4d4d4',
      '--ech-accent': '#ffd700',
      '--ech-border': '#555555',
      '--ech-panel': '#111111',
      '--ech-panel-alt': '#1a1a1a',
      '--ech-success': '#00ff00',
      '--ech-warning': '#ffd700',
      '--ech-danger': '#ff4444',
      '--ech-info': '#00bfff',
      '--ech-font-family': 'system-ui, sans-serif',
      '--ech-font-mono': 'ui-monospace, monospace',
      '--ech-font-size': '15px',
      '--ech-radius': '2px',
      '--ech-radius-sm': '1px',
      '--ech-spacing': '18px',
      '--ech-spacing-sm': '10px',
      '--ech-spacing-xs': '5px',
      '--ech-shadow': 'none',
      '--ech-transition': '0s',
    },
  },
  {
    id: 'bnp-light',
    name: 'BNP Paribas Light',
    description: 'Jasna tema oparta na brand guidelines BNP Paribas — BNP Green (#00965E), czyste białe tło, profesjonalna typografia.',
    category: 'light',
    preview: '#ffffff',
    variables: {
      '--ech-bg': '#f5f7f6',
      '--ech-fg': '#1a1a1a',
      '--ech-muted': '#6b7280',
      '--ech-accent': '#00965E',
      '--ech-border': '#d4ddd8',
      '--ech-panel': '#ffffff',
      '--ech-panel-alt': '#eef3f0',
      '--ech-success': '#00965E',
      '--ech-warning': '#e8a317',
      '--ech-danger': '#d42828',
      '--ech-info': '#007348',
      '--ech-font-family': '"BNP Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
      '--ech-font-mono': '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
      '--ech-font-size': '14px',
      '--ech-radius': '4px',
      '--ech-radius-sm': '2px',
      '--ech-spacing': '16px',
      '--ech-spacing-sm': '8px',
      '--ech-spacing-xs': '4px',
      '--ech-shadow': '0 1px 3px rgba(0,0,0,0.08)',
      '--ech-transition': '0.15s ease',
    },
  },
  {
    id: 'bnp-dark',
    name: 'BNP Paribas Dark',
    description: 'Ciemna tema BNP Paribas — BNP Green na ciemnym tle, profesjonalny kontrast dla dealing room.',
    category: 'dark',
    preview: '#0d1f17',
    variables: {
      '--ech-bg': '#0a1610',
      '--ech-fg': '#e0ebe5',
      '--ech-muted': '#8aaa98',
      '--ech-accent': '#00965E',
      '--ech-border': '#1e3a2c',
      '--ech-panel': '#0d1f17',
      '--ech-panel-alt': '#122a1f',
      '--ech-success': '#39A87B',
      '--ech-warning': '#e8a317',
      '--ech-danger': '#e05252',
      '--ech-info': '#6ABB97',
      '--ech-font-family': '"BNP Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
      '--ech-font-mono': '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
      '--ech-font-size': '13px',
      '--ech-radius': '4px',
      '--ech-radius-sm': '2px',
      '--ech-spacing': '16px',
      '--ech-spacing-sm': '8px',
      '--ech-spacing-xs': '4px',
      '--ech-shadow': '0 2px 8px rgba(0,0,0,0.3)',
      '--ech-transition': '0.15s ease',
    },
  },
];

export function applyTheme(theme: CssTheme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-ech-theme', theme.id);
}

export function getCurrentThemeId(): string {
  return document.documentElement.getAttribute('data-ech-theme') ?? 'dark-default';
}
