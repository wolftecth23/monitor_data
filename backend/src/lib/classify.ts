// First-pass productivity heuristic for ActivityEvent rows, matched against
// the foreground app's process name and/or the tracked URL's domain. Not a
// user-configurable mapping table yet — just enough to populate the
// "Mapping status" / productive-time columns on the reports.

const PRODUCTIVE_PATTERNS = [
  "code",
  "devenv",
  "idea",
  "webstorm",
  "pycharm",
  "terminal",
  "powershell",
  "cmd.exe",
  "github",
  "gitlab",
  "stackoverflow",
  "figma",
  "notion",
  "excel",
  "word",
  "powerpoint",
  "outlook",
  "slack",
  "teams",
  "zoom",
  "jira",
  "confluence",
];

const UNPRODUCTIVE_PATTERNS = [
  "facebook",
  "instagram",
  "twitter",
  "x.com",
  "tiktok",
  "youtube",
  "netflix",
  "reddit",
  "twitch",
  "spotify",
  "steam",
  "discord",
];

export type Classification = { category: "productive" | "unproductive" | "neutral"; isProductive: boolean | null };

export function classifyActivity(appName?: string | null, url?: string | null): Classification {
  const haystack = `${appName ?? ""} ${url ?? ""}`.toLowerCase();
  if (!haystack.trim()) return { category: "neutral", isProductive: null };

  if (UNPRODUCTIVE_PATTERNS.some((p) => haystack.includes(p))) {
    return { category: "unproductive", isProductive: false };
  }
  if (PRODUCTIVE_PATTERNS.some((p) => haystack.includes(p))) {
    return { category: "productive", isProductive: true };
  }
  return { category: "neutral", isProductive: null };
}
