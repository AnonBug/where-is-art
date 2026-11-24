/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASSET_BASE_URL?: string;
  readonly VITE_CONTENT_BASE_URL?: string;
  readonly VITE_TIANDITU_KEY?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  readonly VITE_UMAMI_SCRIPT_URL?: string;
  readonly VITE_UMAMI_DOMAINS?: string;
}
