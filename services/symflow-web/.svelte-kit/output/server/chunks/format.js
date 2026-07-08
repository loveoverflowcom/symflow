//#region src/lib/utils/format.ts
function formatDate(value) {
	if (!value) return "N/A";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(void 0, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(date);
}
function prettyJson(value) {
	if (value === void 0) return "";
	return JSON.stringify(value, null, 2);
}
function normalizeLogEntries(raw) {
	if (!Array.isArray(raw)) return [];
	return raw.filter((item) => typeof item === "object" && item !== null);
}
//#endregion
export { normalizeLogEntries as n, prettyJson as r, formatDate as t };
