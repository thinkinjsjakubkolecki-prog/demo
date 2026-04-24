import { bootstrapApplication } from '@angular/platform-browser';
import { AppShellComponent, APP_SHELL_CONFIG } from '@echelon-framework/widgets-core';
import { loadSavedTheme } from '@echelon-framework/designer-widgets';
import { appConfig } from './app/app.config';
import { menu } from './app/bootstrap/menu';

function detectEnv(): 'dev' | 'test' | 'prod' {
  const override = new URL(window.location.href).searchParams.get('env')
                ?? sessionStorage.getItem('echelon.env');
  if (override === 'dev' || override === 'test' || override === 'prod') {
    sessionStorage.setItem('echelon.env', override);
    return override;
  }
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return 'dev';
  if (/test|stage|uat|qa/i.test(h)) return 'test';
  return 'prod';
}
document.documentElement.dataset['env'] = detectEnv();
loadSavedTheme();

bootstrapApplication(AppShellComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    {
      provide: APP_SHELL_CONFIG,
      useValue: {
        brand: 'DEALER FX',
        envLabel: (document.documentElement.dataset['env'] ?? 'dev').toUpperCase(),
        menu,
      },
    },
  ],
}).catch(console.error);
