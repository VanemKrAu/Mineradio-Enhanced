/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SPLASH?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}