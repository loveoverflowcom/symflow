import { C as escape_html, S as attr, c as store_get, i as derived, l as unsubscribe_stores, t as attr_class } from "./server.js";
import "./client.js";
import { t as authUser } from "./session.js";
import { n as t, t as language } from "./i18n.js";
import { t as page } from "./state.js";
//#region src/lib/components/SidebarMenuItem.svelte
function SidebarMenuItem($$renderer, $$props) {
	let { href, label, icon, active = false, expandable = false, collapsed = false } = $$props;
	$$renderer.push(`<a${attr_class("sidebar-menu-item", void 0, {
		"active": active,
		"icon-only": collapsed
	})}${attr("href", href)}${attr("aria-current", active ? "page" : void 0)}${attr("title", collapsed ? label : void 0)}><svg viewBox="0 0 24 24" aria-hidden="true">`);
	if (icon === "home") {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"></path>`);
	} else if (icon === "agents") {
		$$renderer.push("<!--[1-->");
		$$renderer.push(`<circle cx="12" cy="12" r="8"></circle><path d="M9.5 9.5h.01M14.5 9.5h.01M9 14.5c1.8 1.4 4.2 1.4 6 0"></path>`);
	} else if (icon === "connectors") {
		$$renderer.push("<!--[2-->");
		$$renderer.push(`<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><path d="M10 6.5h4a3.5 3.5 0 0 1 3.5 3.5v4M6.5 10v4A3.5 3.5 0 0 0 10 17.5h4"></path>`);
	} else if (icon === "workflows") {
		$$renderer.push("<!--[3-->");
		$$renderer.push(`<path d="M5 4h14a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2Z"></path><path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9M7 13h4M7 16h8"></path>`);
	} else if (icon === "settings") {
		$$renderer.push("<!--[4-->");
		$$renderer.push(`<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.95 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.05 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.62.76 1.03 1.4 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"></path>`);
	} else {
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"></path>`);
	}
	$$renderer.push(`<!--]--></svg> `);
	if (!collapsed) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<span>${escape_html(label)}</span> `);
		if (expandable) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<svg class="menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 10 3 3 3-3"></path></svg>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
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
		let sidebarCollapsed = false;
		const currentPath = derived(() => page.url.pathname);
		$$renderer.push(`<div${attr_class("page-shell", void 0, { "sidebar-collapsed": sidebarCollapsed })}><aside${attr_class("sidebar", void 0, { "collapsed": sidebarCollapsed })}><div class="sidebar-brand">`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<span class="brand-mark" aria-hidden="true">S</span> <span>${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "appName"))}</span>`);
		$$renderer.push(`<!--]--> <button${attr_class("collapse-toggle", void 0, { "collapsed": sidebarCollapsed })} type="button"${attr("aria-label", "Collapse sidebar")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M9 3v18"></path></svg></button></div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<a class="new-chat-button" href="/">${escape_html(t(store_get($$store_subs ??= {}, "$language", language), "newChat"))}</a>`);
		$$renderer.push(`<!--]--> <nav class="sidebar-nav"${attr("aria-label", t(store_get($$store_subs ??= {}, "$language", language), "mainNavigation"))}>`);
		SidebarMenuItem($$renderer, {
			href: "/",
			label: t(store_get($$store_subs ??= {}, "$language", language), "home"),
			icon: "home",
			active: currentPath() === "/",
			collapsed: sidebarCollapsed
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/agents",
			label: t(store_get($$store_subs ??= {}, "$language", language), "agents"),
			icon: "agents",
			active: currentPath().startsWith("/agents"),
			collapsed: sidebarCollapsed
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/connectors",
			label: t(store_get($$store_subs ??= {}, "$language", language), "connectors"),
			icon: "connectors",
			active: currentPath().startsWith("/connectors"),
			collapsed: sidebarCollapsed
		});
		$$renderer.push(`<!----> `);
		SidebarMenuItem($$renderer, {
			href: "/flows",
			label: t(store_get($$store_subs ??= {}, "$language", language), "workflows"),
			icon: "workflows",
			active: currentPath().startsWith("/flows") || currentPath().startsWith("/runs"),
			collapsed: sidebarCollapsed
		});
		$$renderer.push(`<!----></nav> <div class="sidebar-footer"><nav class="sidebar-support"${attr("aria-label", t(store_get($$store_subs ??= {}, "$language", language), "supportNavigation"))}>`);
		SidebarMenuItem($$renderer, {
			href: "/settings",
			label: t(store_get($$store_subs ??= {}, "$language", language), "settings"),
			icon: "settings",
			active: currentPath().startsWith("/settings"),
			collapsed: sidebarCollapsed
		});
		$$renderer.push(`<!----></nav> <div class="profile-menu"><button class="profile-trigger" type="button"${attr("aria-expanded", profileOpen)} aria-haspopup="menu"><span class="profile-avatar" aria-hidden="true">${escape_html(store_get($$store_subs ??= {}, "$authUser", authUser)?.username.charAt(0).toUpperCase() || "U")}</span> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<span class="profile-name">${escape_html(store_get($$store_subs ??= {}, "$authUser", authUser)?.username || t(store_get($$store_subs ??= {}, "$language", language), "userName"))}</span> <span class="profile-more" aria-hidden="true">•••</span>`);
		$$renderer.push(`<!--]--></button> `);
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
