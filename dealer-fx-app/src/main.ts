import '@angular/compiler';  // JIT for components shipped from @echelon-framework/runtime (until library ships AOT'd)
import { bootstrapApplication } from '@angular/platform-browser';
import { AppShellComponent, APP_SHELL_CONFIG } from '@echelon-framework/widgets-core';
import { appConfig } from './app/app.config';
import { menu } from './app/bootstrap/menu';
import { userMenu } from './app/bootstrap/user';

/**
 * Env detection — steruje kolorem akcentu (CSS var --accent przez [data-env]).
 *  - `dev`   → pomarańcz (localhost / 127.0.0.1 / *.local)
 *  - `test`  → żółty   (hostname zawiera "test" lub "stage")
 *  - `prod`  → zieleń  (reszta)
 *
 * Override: `?env=dev|test|prod` w query stringu (persist w sessionStorage).
 */
function detectEnv(): 'dev' | 'test' | 'prod' {
  const override = new URL(window.location.href).searchParams.get('env')
                ?? sessionStorage.getItem('echelon.env');
  if (override === 'dev' || override === 'test' || override === 'prod') {
    sessionStorage.setItem('echelon.env', override);
    return override;
  }
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) { return 'dev'; }
  if (/test|stage|uat|qa/i.test(h)) { return 'test'; }
  return 'prod';
}
document.documentElement.dataset['env'] = detectEnv();

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
        userMenu,
      },
    },
  ],
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
