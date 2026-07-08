import { a as head, b as attr, n as bind_props, r as derived, x as escape_html } from "./server.js";
import "./client.js";
import { t as AppShell } from "./AppShell.js";
import "./client2.js";
import "yaml";
//#region src/lib/components/DslEditor.svelte
function DslEditor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { value = "", disabled = false } = $$props;
		$$renderer.push(`<div class="stack"><div class="editor-toolbar"><span class="muted">YAML DSL</span> <button class="secondary-button" type="button"${attr("disabled", disabled, true)}>Validate</button></div> <textarea class="dsl-editor"${attr("disabled", disabled, true)} placeholder="name: demo-flow steps:   - id: read_file     kind: local_file_reader" spellcheck="false">`);
		const $$body = escape_html(value);
		if ($$body) $$renderer.push(`${$$body}`);
		$$renderer.push(`</textarea> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
		bind_props($$props, { value });
	});
}
//#endregion
//#region src/routes/flows/shared-editor.svelte
function Shared_editor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { flow } = $$props;
		let name = "";
		let dslScript = "";
		let runInputsText = "{\n  \"input\": \"example\"\n}";
		let isRunning = false;
		const pageTitle = derived(() => flow ? "Edit flow" : "New flow");
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			head("mh9iut", $$renderer, ($$renderer) => {
				$$renderer.title(($$renderer) => {
					$$renderer.push(`<title>${escape_html(pageTitle())} | Symflow</title>`);
				});
			});
			{
				function actions($$renderer) {
					$$renderer.push(`<a class="secondary-button" href="/flows">Back to flows</a>`);
				}
				AppShell($$renderer, {
					title: pageTitle(),
					subtitle: "Author the YAML DSL, save it to the backend, and trigger a run when you are ready.",
					actions,
					children: ($$renderer) => {
						$$renderer.push(`<section class="editor-layout"><article class="card stack"><label class="stack-sm"><span>Name</span> <input${attr("value", name)} placeholder="hello-world-flow"/></label> `);
						DslEditor($$renderer, {
							disabled: isRunning,
							get value() {
								return dslScript;
							},
							set value($$value) {
								dslScript = $$value;
								$$settled = false;
							}
						});
						$$renderer.push(`<!----> `);
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> <div class="button-row"><button class="primary-button" type="button"${attr("disabled", true, true)}>${escape_html("Save flow")}</button></div></article> <aside class="card stack"><div class="stack-sm"><h2>Run flow</h2> <p class="muted">Trigger a run with ad hoc JSON inputs after the flow has been saved.</p></div> <label class="stack-sm"><span>Inputs</span> <textarea class="dsl-editor compact" spellcheck="false">`);
						const $$body = escape_html(runInputsText);
						if ($$body) $$renderer.push(`${$$body}`);
						$$renderer.push(`</textarea></label> <button class="primary-button" type="button"${attr("disabled", true, true)}>${escape_html("Run flow")}</button></aside></section>`);
					},
					$$slots: {
						actions: true,
						default: true
					}
				});
			}
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
//#endregion
export { Shared_editor as t };
