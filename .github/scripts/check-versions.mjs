// Compares live upstream versions against .github/tracked-versions.json and
// reports drift via $GITHUB_OUTPUT. Read-only: does not write the state file
// or commit anything — see README.md "How this was built" for why (it does
// not edit skill content either; a human, via the opened issue, does that).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATE_PATH = fileURLToPath(new URL("../tracked-versions.json", import.meta.url));

const LABELS = {
  typescript_latest: "typescript@latest",
  typescript_rc: "typescript@rc",
  typescript_native_preview_latest: "@typescript/native-preview@latest",
  node_latest: "node (latest release)",
  oxlint_latest: "oxlint@latest",
  oxfmt_latest: "oxfmt@latest",
};

async function npmDistTag(pkg, tag) {
  const res = await fetch(`https://registry.npmjs.org/-/package/${encodeURIComponent(pkg)}/dist-tags`);
  if (!res.ok) throw new Error(`npm dist-tags fetch failed for ${pkg}: ${res.status}`);
  const tags = await res.json();
  return tags[tag] ?? null;
}

async function latestNodeRelease() {
  const res = await fetch("https://nodejs.org/dist/index.json");
  if (!res.ok) throw new Error(`node release index fetch failed: ${res.status}`);
  const releases = await res.json();
  return releases[0]?.version?.replace(/^v/, "") ?? null;
}

const previous = JSON.parse(readFileSync(STATE_PATH, "utf8"));

const [typescript_latest, typescript_rc, typescript_native_preview_latest, node_latest, oxlint_latest, oxfmt_latest] =
  await Promise.all([
    npmDistTag("typescript", "latest"),
    npmDistTag("typescript", "rc").catch(() => null),
    npmDistTag("@typescript/native-preview", "latest").catch(() => null),
    latestNodeRelease(),
    npmDistTag("oxlint", "latest"),
    npmDistTag("oxfmt", "latest"),
  ]);

const current = {
  typescript_latest: typescript_latest ?? previous.typescript_latest,
  typescript_rc: typescript_rc ?? previous.typescript_rc,
  typescript_native_preview_latest: typescript_native_preview_latest ?? previous.typescript_native_preview_latest,
  node_latest: node_latest ?? previous.node_latest,
  oxlint_latest: oxlint_latest ?? previous.oxlint_latest,
  oxfmt_latest: oxfmt_latest ?? previous.oxfmt_latest,
};

const changedKeys = Object.keys(current).filter((k) => current[k] !== previous[k]);

const summaryLines = changedKeys.map((k) => `- **${LABELS[k] ?? k}**: \`${previous[k] ?? "(none)"}\` → \`${current[k]}\``);
const summary = summaryLines.join("\n");

console.log(changedKeys.length > 0 ? `Drift detected:\n${summary}` : "No drift.");

const outPath = process.env.GITHUB_OUTPUT;
if (outPath) {
  const lines = [`drift=${changedKeys.length > 0}`, "summary<<__SUMMARY_EOF__", summary, "__SUMMARY_EOF__"];
  writeFileSync(outPath, lines.join("\n") + "\n", { flag: "a" });
}
