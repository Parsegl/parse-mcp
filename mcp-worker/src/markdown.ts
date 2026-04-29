const BASE_URL = "https://parse.gl";
const UTM = "utm_source=mcp&utm_medium=tool";

function appendUtm(path: string, campaign: string) {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("utm_source", "mcp");
  url.searchParams.set("utm_medium", "tool");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

export function escapeMarkdown(value: unknown): string {
  return String(value ?? "").replace(/[\\`*_{}[\]()#+!|>-]/g, "\\$&");
}

export function parseUrl(path: string, campaign: string) {
  return appendUtm(path, campaign);
}

export function withFooter(text: string, campaign: string) {
  return `${text.trim()}\n\nSource: Parse public index. Full data at ${BASE_URL}/?${UTM}&utm_campaign=${encodeURIComponent(campaign)}.`;
}

export function jsonText(value: unknown) {
  return JSON.stringify(value, null, 2);
}
