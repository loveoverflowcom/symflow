import { b as attr, n as derived, o as store_get, s as unsubscribe_stores, t as attr_class, x as escape_html } from "./server.js";
import "./client.js";
import { t as authUser } from "./session.js";
import "./theme.js";
import { n as t, t as language } from "./i18n.js";
import { t as page } from "./state.js";
//#region src/lib/components/SidebarMenuItem.svelte
function SidebarMenuItem($$renderer, $$props) {
	let { href, label, icon, active = false, expandable = false } = $$props;
	$$renderer.push(`<a${attr_class("sidebar-menu-item", void 0, { "active": active })}${attr("href", href)}${attr("aria-current", active ? "page" : void 0)}><svg viewBox="0 0 24 24" aria-hidden="true">`);
	if (icon === "home") {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"></path>`);
	} else if (icon === "agents") {
		$$renderer.push("<!--[1-->");
		$$renderer.push(`<circle cx="12" cy="12" r="8"></circle><path d="M9.5 9.5h.01M14.5 9.5h.01M9 14.5c1.8 1.4 4.2 1.4 6 0"></path>`);
	} else if (icon === "skills") {
		$$renderer.push("<!--[2-->");
		$$renderer.push(`<path d="m13 2-9 12h7l-1 8 10-13h-7z"></path>`);
	} else if (icon === "artifacts") {
		$$renderer.push("<!--[3-->");
		$$renderer.push(`<rect x="3" y="5" width="18" height="15" rx="2"></rect><path d="M7 9h.01M11 9h6M7 13h10M7 17h6"></path>`);
	} else if (icon === "connectors") {
		$$renderer.push("<!--[4-->");
		$$renderer.push(`<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><path d="M10 6.5h4a3.5 3.5 0 0 1 3.5 3.5v4M6.5 10v4A3.5 3.5 0 0 0 10 17.5h4"></path>`);
	} else if (icon === "tasks") {
		$$renderer.push("<!--[5-->");
		$$renderer.push(`<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"></path>`);
	} else if (icon === "secrets") {
		$$renderer.push("<!--[6-->");
		$$renderer.push(`<rect x="4" y="7" width="16" height="14" rx="2"></rect><path d="M8 7V5a4 4 0 0 1 8 0v2M12 13v3"></path>`);
	} else if (icon === "workflows") {
		$$renderer.push("<!--[7-->");
		$$renderer.push(`<rect x="3" y="3" width="6" height="6" rx="1"></rect><rect x="15" y="15" width="6" height="6" rx="1"></rect><path d="M9 6h3a3 3 0 0 1 3 3v6M6 9v6a3 3 0 0 0 3 3h6"></path>`);
	} else if (icon === "settings") {
		$$renderer.push("<!--[8-->");
		$$renderer.push(`<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.95 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.05 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.62.76 1.03 1.4 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"></path>`);
	} else {
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"></path>`);
	}
	$$renderer.push(`<!--]--></svg> <span>${escape_html(label)}</span> `);
	if (expandable) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<svg class="menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 10 3 3 3-3"></path></svg>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></a>`);
}
//#endregion
//#region src/lib/components/AppShell.svelte
function AppShell($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { actions, children } = $$props;
		let profileOpen = false;
		const currentPath = derived(() => page.url.pathname);
		$$renderer.push(`<div class="page-shell"><aside class="sidebar"><div class="sidebar-brand"><span class="brand-mark" aria-hidden="true">S</span> <span>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "appName"))}</span></div> <a class="new-chat-button" href="/">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "newChat"))}</a> <nav class="sidebar-nav"${attr("aria-label", t(store_get($$store_subs ??= {}, "$language", language), "mainNavigation"))}>`);
		SidebarMenuItem($$renderer, {
			href: "/",
			label: t(store_get($$store_subs ??= {}, "$language", language), "home"),
			icon: "home",
			active: currentPath() === "/"
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/#agents",
			label: t(store_get($$store_subs ??= {}, "$language", language), "agents"),
			icon: "agents",
			expandable: true
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/#skills",
			label: t(store_get($$store_subs ??= {}, "$language", language), "skills"),
			icon: "skills"
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/#artifacts",
			label: t(store_get($$store_subs ??= {}, "$language", language), "artifacts"),
			icon: "artifacts"
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/#connectors",
			label: t(store_get($$store_subs ??= {}, "$language", language), "connectors"),
			icon: "connectors"
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/#tasks",
			label: t(store_get($$store_subs ??= {}, "$language", language), "tasks"),
			icon: "tasks"
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/#secrets",
			label: t(store_get($$store_subs ??= {}, "$language", language), "secrets"),
			icon: "secrets"
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/flows",
			label: t(store_get($$store_subs ??= {}, "$language", language), "workflows"),
			icon: "workflows",
			active: currentPath().startsWith("/flows") || currentPath().startsWith("/runs")
		});
		$$renderer.push(`<!----></nav> <div class="sidebar-footer"><nav class="sidebar-support"${attr("aria-label", t(store_get($$store_subs ??= {}, "$language", language), "supportNavigation"))}>`);
		SidebarMenuItem($$renderer, {
			href: "/#settings",
			label: t(store_get($$store_subs ??= {}, "$language", language), "settings"),
			icon: "settings"
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/#contact",
			label: t(store_get($$store_subs ??= {}, "$language", language), "contactSales"),
			icon: "contact"
		});
		$$renderer.push(`<!----></nav> <section class="credits-panel"${attr("aria-label", t(store_get($$store_subs ??= {}, "$language", language), "creditsRemaining"))}><div class="credits-copy"><span>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "creditsRemaining"))}</span> <strong>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "creditsValue"))}</strong></div> <div class="credits-track" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100"><span></span></div> <a class="upgrade-button" href="/#upgrade">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "upgradePlan"))}</a></section> <div class="profile-menu"><button class="profile-trigger" type="button"${attr("aria-expanded", profileOpen)} aria-haspopup="menu"><span class="profile-avatar" aria-hidden="true">${escape_html(store_get($$store_subs ??= {}, "$authUser", authUser)?.username.charAt(0).toUpperCase() || "U")}</span> <span class="profile-name">${escape_html(store_get($$store_subs ??= {}, "$authUser", authUser)?.username || t(store_get($$store_subs ??= {}, "$language", language), "userName"))}</span> <span class="profile-more" aria-hidden="true">•••</span></button> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div></aside> <div class="content-area">`);
		if (actions) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<header class="content-header"><div class="actions">`);
			actions($$renderer);
			$$renderer.push(`<!----></div></header>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <main class="page-content">`);
		if (children) {
			$$renderer.push("<!--[0-->");
			children($$renderer);
			$$renderer.push(`<!---->`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></main></div></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { AppShell as t };
