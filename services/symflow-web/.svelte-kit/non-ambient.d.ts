
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/agents" | "/connectors" | "/flows" | "/flows/new" | "/flows/[id]" | "/login" | "/register" | "/runs" | "/runs/[id]" | "/settings";
		RouteParams(): {
			"/flows/[id]": { id: string };
			"/runs/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string | undefined };
			"/agents": Record<string, never>;
			"/connectors": Record<string, never>;
			"/flows": { id?: string | undefined };
			"/flows/new": Record<string, never>;
			"/flows/[id]": { id: string };
			"/login": Record<string, never>;
			"/register": Record<string, never>;
			"/runs": { id?: string | undefined };
			"/runs/[id]": { id: string };
			"/settings": Record<string, never>
		};
		Pathname(): "/" | "/agents" | "/connectors" | "/flows" | "/flows/new" | `/flows/${string}` & {} | "/login" | "/register" | `/runs/${string}` & {} | "/settings";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}