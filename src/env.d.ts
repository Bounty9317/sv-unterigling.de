/** Kennung des Builds (astro.config.mjs) */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly PUBLIC_USE_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
