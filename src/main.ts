// Some CJS browser bundles (e.g. sockjs-client) expect Node-like global.
(globalThis as any).global ??= globalThis;

Promise.all([
  import('@angular/platform-browser'),
  import('./app/app.config'),
  import('./app/app.component')
])
  .then(([platform, config, component]) =>
    platform.bootstrapApplication(component.AppComponent, config.appConfig)
  )
  .catch((err) => console.error(err));
