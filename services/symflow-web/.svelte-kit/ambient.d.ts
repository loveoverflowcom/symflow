
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SVELTEKIT_FORK: string;
	export const NODE_ENV: string;
	export const npm_config_allow_scripts: string;
	export const LC_NUMERIC: string;
	export const npm_execpath: string;
	export const npm_config_globalconfig: string;
	export const XDG_VTNR: string;
	export const VSCODE_CODE_CACHE_PATH: string;
	export const QT_IM_MODULE: string;
	export const EDITOR: string;
	export const GIT_PAGER: string;
	export const LC_IDENTIFICATION: string;
	export const CODEX_THREAD_ID: string;
	export const LESSCLOSE: string;
	export const npm_config_init_module: string;
	export const QT_ACCESSIBILITY: string;
	export const npm_lifecycle_event: string;
	export const LC_NAME: string;
	export const npm_lifecycle_script: string;
	export const LS_COLORS: string;
	export const XDG_SESSION_DESKTOP: string;
	export const GH_PAGER: string;
	export const XMODIFIERS: string;
	export const TEXTDOMAINDIR: string;
	export const XDG_DATA_HOME: string;
	export const LC_PAPER: string;
	export const LC_TELEPHONE: string;
	export const LANG: string;
	export const GDK_BACKEND: string;
	export const XDG_RUNTIME_DIR: string;
	export const LC_ADDRESS: string;
	export const XDG_SEAT_PATH: string;
	export const TEXTDOMAIN: string;
	export const PAGER: string;
	export const DESKTOP_SESSION: string;
	export const CHROME_DESKTOP: string;
	export const GTK_OVERLAY_SCROLLING: string;
	export const HOME: string;
	export const npm_config_npm_version: string;
	export const RUST_LOG: string;
	export const npm_config_noproxy: string;
	export const BROWSER: string;
	export const LXQT_SESSION_CONFIG: string;
	export const USER: string;
	export const CODEX_CI: string;
	export const XDG_CACHE_HOME: string;
	export const npm_node_execpath: string;
	export const SHLVL: string;
	export const XDG_SESSION_TYPE: string;
	export const XAUTHORITY: string;
	export const npm_config_local_prefix: string;
	export const SSH_AGENT_PID: string;
	export const DISPLAY: string;
	export const VSCODE_IPC_HOOK: string;
	export const XDG_DATA_DIRS: string;
	export const LESSOPEN: string;
	export const SHELL: string;
	export const npm_config_node_gyp: string;
	export const DEBUG: string;
	export const npm_config_user_agent: string;
	export const COLORTERM: string;
	export const VSCODE_CWD: string;
	export const QT_PLATFORM_PLUGIN: string;
	export const GTK_CSD: string;
	export const LC_TIME: string;
	export const CODEX_INTERNAL_ORIGINATOR_OVERRIDE: string;
	export const VSCODE_PID: string;
	export const NO_COLOR: string;
	export const npm_config_prefix: string;
	export const npm_config_global_prefix: string;
	export const IM_CONFIG_ENTRY: string;
	export const VSCODE_ESM_ENTRYPOINT: string;
	export const XDG_SESSION_CLASS: string;
	export const npm_package_version: string;
	export const XDG_SEAT: string;
	export const npm_command: string;
	export const GPG_AGENT_INFO: string;
	export const LOGNAME: string;
	export const CLUTTER_IM_MODULE: string;
	export const SSH_AUTH_SOCK: string;
	export const LC_MONETARY: string;
	export const LC_ALL: string;
	export const LC_CTYPE: string;
	export const VSCODE_NLS_CONFIG: string;
	export const PATH: string;
	export const npm_config_userconfig: string;
	export const ELECTRON_RUN_AS_NODE: string;
	export const npm_package_json: string;
	export const VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const INIT_CWD: string;
	export const DEBUGINFOD_URLS: string;
	export const COLOR: string;
	export const QT_QPA_PLATFORMTHEME: string;
	export const GTK_IM_MODULE: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const _: string;
	export const XDG_CONFIG_DIRS: string;
	export const TERM: string;
	export const PWD: string;
	export const SAL_USE_VCLPLUGIN: string;
	export const VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
	export const XDG_SESSION_ID: string;
	export const npm_config_cache: string;
	export const FC_FONTATIONS: string;
	export const XDG_CONFIG_HOME: string;
	export const NODE: string;
	export const LC_MEASUREMENT: string;
	export const XDG_MENU_PREFIX: string;
	export const npm_package_name: string;
	export const XDG_SESSION_PATH: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SVELTEKIT_FORK: string;
		NODE_ENV: string;
		npm_config_allow_scripts: string;
		LC_NUMERIC: string;
		npm_execpath: string;
		npm_config_globalconfig: string;
		XDG_VTNR: string;
		VSCODE_CODE_CACHE_PATH: string;
		QT_IM_MODULE: string;
		EDITOR: string;
		GIT_PAGER: string;
		LC_IDENTIFICATION: string;
		CODEX_THREAD_ID: string;
		LESSCLOSE: string;
		npm_config_init_module: string;
		QT_ACCESSIBILITY: string;
		npm_lifecycle_event: string;
		LC_NAME: string;
		npm_lifecycle_script: string;
		LS_COLORS: string;
		XDG_SESSION_DESKTOP: string;
		GH_PAGER: string;
		XMODIFIERS: string;
		TEXTDOMAINDIR: string;
		XDG_DATA_HOME: string;
		LC_PAPER: string;
		LC_TELEPHONE: string;
		LANG: string;
		GDK_BACKEND: string;
		XDG_RUNTIME_DIR: string;
		LC_ADDRESS: string;
		XDG_SEAT_PATH: string;
		TEXTDOMAIN: string;
		PAGER: string;
		DESKTOP_SESSION: string;
		CHROME_DESKTOP: string;
		GTK_OVERLAY_SCROLLING: string;
		HOME: string;
		npm_config_npm_version: string;
		RUST_LOG: string;
		npm_config_noproxy: string;
		BROWSER: string;
		LXQT_SESSION_CONFIG: string;
		USER: string;
		CODEX_CI: string;
		XDG_CACHE_HOME: string;
		npm_node_execpath: string;
		SHLVL: string;
		XDG_SESSION_TYPE: string;
		XAUTHORITY: string;
		npm_config_local_prefix: string;
		SSH_AGENT_PID: string;
		DISPLAY: string;
		VSCODE_IPC_HOOK: string;
		XDG_DATA_DIRS: string;
		LESSOPEN: string;
		SHELL: string;
		npm_config_node_gyp: string;
		DEBUG: string;
		npm_config_user_agent: string;
		COLORTERM: string;
		VSCODE_CWD: string;
		QT_PLATFORM_PLUGIN: string;
		GTK_CSD: string;
		LC_TIME: string;
		CODEX_INTERNAL_ORIGINATOR_OVERRIDE: string;
		VSCODE_PID: string;
		NO_COLOR: string;
		npm_config_prefix: string;
		npm_config_global_prefix: string;
		IM_CONFIG_ENTRY: string;
		VSCODE_ESM_ENTRYPOINT: string;
		XDG_SESSION_CLASS: string;
		npm_package_version: string;
		XDG_SEAT: string;
		npm_command: string;
		GPG_AGENT_INFO: string;
		LOGNAME: string;
		CLUTTER_IM_MODULE: string;
		SSH_AUTH_SOCK: string;
		LC_MONETARY: string;
		LC_ALL: string;
		LC_CTYPE: string;
		VSCODE_NLS_CONFIG: string;
		PATH: string;
		npm_config_userconfig: string;
		ELECTRON_RUN_AS_NODE: string;
		npm_package_json: string;
		VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		INIT_CWD: string;
		DEBUGINFOD_URLS: string;
		COLOR: string;
		QT_QPA_PLATFORMTHEME: string;
		GTK_IM_MODULE: string;
		XDG_CURRENT_DESKTOP: string;
		_: string;
		XDG_CONFIG_DIRS: string;
		TERM: string;
		PWD: string;
		SAL_USE_VCLPLUGIN: string;
		VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
		XDG_SESSION_ID: string;
		npm_config_cache: string;
		FC_FONTATIONS: string;
		XDG_CONFIG_HOME: string;
		NODE: string;
		LC_MEASUREMENT: string;
		XDG_MENU_PREFIX: string;
		npm_package_name: string;
		XDG_SESSION_PATH: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
