export interface AnalyticsPage {
  url: string;
  title: string;
}

type Payload = Record<string, unknown>;
type Tracker = { track: (payload: (defaults: Payload) => Payload) => unknown };
declare global {
  interface Window {
    umami?: Tracker;
  }
}

const scriptId = "art-analytics";
const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim();
const scriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL?.trim();
const domains = (import.meta.env.VITE_UMAMI_DOMAINS || "anonbug.github.io")
  .split(",")
  .map((value) => value.trim());
let loading: Promise<Tracker | undefined> | undefined;
let currentPage: AnalyticsPage | undefined;
let previousUrl = "";
let pending = 0;
let delivery = Promise.resolve();
let disabledForVisit = false;

export function analyticsDisabled() {
  try {
    return disabledForVisit || Boolean(localStorage.getItem("umami.disabled"));
  } catch {
    return disabledForVisit;
  }
}

export function disableAnalytics() {
  disabledForVisit = true;
  try {
    localStorage.setItem("umami.disabled", "1");
  } catch {
    // Still disable the current visit if browser storage is unavailable.
  }
}

function enabled() {
  if (!import.meta.env.PROD || !websiteId || !scriptUrl) return false;
  if (!domains.includes(window.location.hostname)) return false;
  if (navigator.doNotTrack === "1" || analyticsDisabled()) return false;
  try {
    if (localStorage.getItem("umami.disabled")) return false;
    return new URL(scriptUrl).protocol === "https:";
  } catch {
    return false;
  }
}

function tracker() {
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = scriptUrl!;
    script.dataset.websiteId = websiteId!;
    // The router sends canonical pageviews after the catalog has loaded.
    // Disable automatic navigation/click capture to avoid duplicate counts.
    script.dataset.autoTrack = "false";
    script.dataset.doNotTrack = "true";
    script.dataset.domains = domains.join(",");
    const finish = (value?: Tracker) => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(), 10_000);
    script.onload = () => finish(window.umami);
    script.onerror = () => finish();
    document.head.append(script);
  });
  return loading;
}

function externalReferrer() {
  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === location.origin ? "" : referrer.origin;
  } catch {
    return "";
  }
}

function send(
  page: AnalyticsPage,
  extra: Payload = {},
  referrer = previousUrl,
) {
  if (!enabled() || pending >= 20) return;
  const ready = tracker();
  pending++;
  // Bound the queue while the script is loading. Failed/blocked analytics must
  // never reject into a click handler or prevent browsing and downloading.
  delivery = delivery
    .then(async () => {
      const client = await ready;
      if (!client || !enabled()) return;
      await client.track((defaults) => ({
        ...defaults,
        ...page,
        referrer: referrer || externalReferrer(),
        ...extra,
      }));
    })
    .catch(() => {})
    .finally(() => pending--);
}

export function trackPage(page: AnalyticsPage) {
  if (!enabled() || currentPage?.url === page.url) return;
  previousUrl = currentPage?.url || "";
  currentPage = page;
  send(page);
}

export function trackDownload(work: { id: string; title: string }) {
  if (!currentPage) return;
  send(currentPage, {
    name: "image_download",
    data: { artwork: `${work.title} [${work.id}]`.slice(0, 500) },
  });
}

export function trackSearch(mode: "ai" | "keyword", total: number) {
  if (!currentPage) return;
  send(currentPage, {
    name: "search_complete",
    data: { mode, results: total },
  });
}

export function trackSearchSelection(work: { id: string; title: string }) {
  if (!currentPage) return;
  send(currentPage, {
    name: "search_result_open",
    data: { artwork: `${work.title} [${work.id}]`.slice(0, 500) },
  });
}
