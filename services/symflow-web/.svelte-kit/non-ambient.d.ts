
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
		RouteId(): "/" | "/flows" | "/flows/new" | "/flows/[id]" | "/runs" | "/runs/[id]";
		RouteParams(): {
			"/flows/[id]": { id: string };
			"/runs/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string | undefined };
			"/flows": { id?: string | undefined };
			"/flows/new": Record<string, never>;
			"/flows/[id]": { id: string };
			"/runs": { id?: string | undefined };
			"/runs/[id]": { id: string }
		};
		Pathname(): "/" | "/flows" | "/flows/new" | `/flows/${string}` & {} | `/runs/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}