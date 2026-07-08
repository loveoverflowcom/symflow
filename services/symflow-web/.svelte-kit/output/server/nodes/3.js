import * as universal from '../entries/pages/flows/_page.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/flows/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/flows/+page.ts";
export const imports = ["_app/immutable/nodes/3.DYQKgViC.js","_app/immutable/chunks/DK3Fl9T5.js","_app/immutable/chunks/qANOEdph.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/DuswBF4K.js"];
export const stylesheets = [];
export const fonts = [];
