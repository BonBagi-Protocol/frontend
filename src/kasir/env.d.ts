// The one Vite flag the pay page reads (dev-only test helpers); kept minimal instead of vite/client.
interface ImportMetaEnv {
  readonly DEV: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
