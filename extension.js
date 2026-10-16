const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");
const { CodexUsageClient } = require("./usageClient");

const CODEX_EXTENSION_ID = "openai.chatgpt";
const POLL_INTERVAL_MS = 60_000;

function findCodexExecutable(extensionPath) {
  const targets = {
    "darwin:arm64": "aarch64-apple-darwin",
    "darwin:x64": "x86_64-apple-darwin",
    "linux:arm64": "aarch64-unknown-linux-musl",
    "linux:x64": "x86_64-unknown-linux-musl",
    "win32:arm64": "aarch64-pc-windows-msvc",
    "win32:x64": "x86_64-pc-windows-msvc"
  };
  const target = targets[`${process.platform}:${process.arch}`];
  if (!target) return undefined;

  const binsPath = path.join(extensionPath, "bin");
  if (!fs.existsSync(binsPath)) return undefined;

  for (const entry of fs.readdirSync(binsPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const packagePath = path.join(binsPath, entry.name, "codex-package.json");
    if (!fs.existsSync(packagePath)) continue;

    try {
      const codexPackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      if (codexPackage.target !== target || !codexPackage.entrypoint) continue;

      const packageBinPath = path.join(binsPath, entry.name);
      const candidates = [
        path.join(packageBinPath, codexPackage.entrypoint),
        path.join(packageBinPath, path.basename(codexPackage.entrypoint)),
        path.join(packageBinPath, process.platform === "win32" ? "codex.exe" : "codex")
      ];
      const executable = candidates.find((candidate) => fs.existsSync(candidate));
      if (executable) return executable;
    } catch {
      // Ignore platform bundles that do not contain a valid Codex package manifest.
    }
  }

  return undefined;
}

function remainingPercent(window) {
  const usedPercent = window?.usedPercent ?? window?.used_percent;
  if (typeof usedPercent !== "number" || !Number.isFinite(usedPercent)) return "--%";
  return `${Math.round(Math.max(0, Math.min(100, 100 - usedPercent)))}%`;
}

function resetTime(window, includeDate = false) {
  const resetsAt = window?.resetsAt ?? window?.resets_at;
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return "time unavailable";

  const resetDate = new Date(resetsAt * 1000);
  if (!Number.isFinite(resetDate.getTime())) return "time unavailable";
  if (includeDate) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(resetDate);
  }

  const now = new Date();
  const sameDay = resetDate.getFullYear() === now.getFullYear() &&
    resetDate.getMonth() === now.getMonth() &&
    resetDate.getDate() === now.getDate();
  const formatOptions = sameDay
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

  return new Intl.DateTimeFormat(undefined, formatOptions).format(resetDate);
}

function resetCountdown(window) {
  const resetsAt = window?.resetsAt ?? window?.resets_at;
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt) || resetsAt <= 0) {
    return "time unavailable";
  }

  const minutesRemaining = Math.max(0, Math.ceil((resetsAt * 1000 - Date.now()) / 60_000));
  if (minutesRemaining === 0) return "now";
  if (minutesRemaining < 24 * 60) {
    const hours = Math.floor(minutesRemaining / 60);
    const minutes = minutesRemaining % 60;
    return `${hours}h ${minutes}m`;
  }

  const days = Math.floor(minutesRemaining / (24 * 60));
  const hours = Math.floor((minutesRemaining % (24 * 60)) / 60);
  return `${days}d ${hours}h`;
}

function resetOccurrence(window) {
  const resetsAt = window?.resetsAt ?? window?.resets_at;
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt) || resetsAt <= 0) {
    return "time unavailable";
  }

  const resetDate = new Date(resetsAt * 1000);
  if (!Number.isFinite(resetDate.getTime())) return "time unavailable";

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(resetDate);
  const now = new Date();
  const sameDay = resetDate.getFullYear() === now.getFullYear() &&
    resetDate.getMonth() === now.getMonth() &&
    resetDate.getDate() === now.getDate();

  return sameDay ? time : `${resetDate.getDate()}.${resetDate.getMonth() + 1} at ${time}`;
}

function usageBar(window, color, label) {
  const remaining = remainingPercent(window);
  const percent = Number.parseInt(remaining, 10);
  const fillWidth = Number.isFinite(percent) ? percent * 1.2 : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="8" viewBox="0 0 120 8"><rect width="120" height="8" rx="4" fill="${color}" fill-opacity="0.25"/><rect width="${fillWidth}" height="8" rx="4" fill="${color}"/></svg>`;
  const image = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  return `<img src="${image}" alt="${label}: ${remaining} remaining" width="120" height="8">`;
}

function getCodexWindows(response) {
  const buckets = response?.rateLimitsByLimitId ?? response?.rate_limits_by_limit_id;
  const values = buckets && typeof buckets === "object" ? Object.values(buckets) : [];
  const codexBucket = values.find((bucket) => bucket?.limitId === "codex") ??
    buckets?.codex ??
    response?.rateLimits ??
    response?.rate_limits;

  return [codexBucket?.primary, codexBucket?.secondary].filter(Boolean);
}

function renderUsage(statusItem, response) {
  const windows = getCodexWindows(response);
  const fiveHourWindow = windows.find((window) =>
    (window.windowDurationMins ?? window.window_minutes) === 300
  );
  const weeklyWindow = windows.find((window) =>
    (window.windowDurationMins ?? window.window_minutes) === 10_080
  );

  const visibleFiveHourWindow = fiveHourWindow;
  const visibleWeeklyWindow = weeklyWindow;
  const statusParts = [];
  if (visibleFiveHourWindow) statusParts.push(`5h ${remainingPercent(visibleFiveHourWindow)}`);
  if (visibleWeeklyWindow) statusParts.push(`w ${remainingPercent(visibleWeeklyWindow)}`);
  statusItem.text = statusParts.length
    ? `$(robot) ${statusParts.join(" | ")}`
    : "$(robot) 5h --% | w --%";
  const fiveHourTooltip = visibleFiveHourWindow
    ? `\n\n&nbsp;&nbsp;5-hour window: **${remainingPercent(visibleFiveHourWindow)} (${resetTime(visibleFiveHourWindow)})**&nbsp;&nbsp;  \n<table width="100%"><tr><td>&nbsp;&nbsp;${usageBar(visibleFiveHourWindow, "#f59e0b", "5-hour window")}</td><td align="right">in ${resetCountdown(visibleFiveHourWindow)} (resets ${resetOccurrence(visibleFiveHourWindow)})&nbsp;&nbsp;</td></tr></table>`
    : "";
  const weeklyTooltip = visibleWeeklyWindow
    ? `\n\n&nbsp;&nbsp;Weekly window: **${remainingPercent(visibleWeeklyWindow)} (${resetTime(visibleWeeklyWindow, true)})**&nbsp;&nbsp;  \n<table width="100%"><tr><td>&nbsp;&nbsp;${usageBar(visibleWeeklyWindow, "#40e0d0", "Weekly window")}</td><td align="right">in ${resetCountdown(visibleWeeklyWindow)} (resets ${resetOccurrence(visibleWeeklyWindow)})&nbsp;&nbsp;</td></tr></table>`
    : "";
  const tooltip = new vscode.MarkdownString(
    `<table width="1"><tr><td width="1" height="4"></td></tr></table>\n\n&nbsp;&nbsp;**Codex remaining usage**&nbsp;&nbsp;${fiveHourTooltip}${weeklyTooltip}\n\n<table width="1"><tr><td width="1" height="4"></td></tr></table>`
  );
  tooltip.supportHtml = true;
  statusItem.tooltip = tooltip;
}

function activate(context) {
  const statusItem = vscode.window.createStatusBarItem(
    "codexUsageMonitor.status",
    vscode.StatusBarAlignment.Right,
    -1000
  );
  statusItem.name = "Codex Usage Monitor";
  statusItem.show();
  context.subscriptions.push(statusItem);

  let client;
  let retryTimer;
  let disposed = false;

  const showNotInstalled = () => {
    statusItem.text = "$(robot) (-)";
    statusItem.tooltip = "Codex VS Code extension is not installed";
  };

  const showUnavailable = () => {
    statusItem.text = "$(robot) 5h --% | w --%";
    statusItem.tooltip = "Codex usage is currently unavailable";
  };

  const scheduleRetry = () => {
    if (disposed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      connectToCodex();
    }, POLL_INTERVAL_MS);
  };

  const stopClient = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    client?.dispose();
    client = undefined;
  };

  const connectToCodex = () => {
    if (disposed) return;

    const codexExtension = vscode.extensions.getExtension(CODEX_EXTENSION_ID);
    if (!codexExtension) {
      stopClient();
      showNotInstalled();
      return;
    }

    if (client) return;

    const executable = findCodexExecutable(codexExtension.extensionPath);
    if (!executable) {
      showUnavailable();
      scheduleRetry();
      return;
    }

    showUnavailable();
    const usageClient = new CodexUsageClient(executable, {
      onUsage: (response) => renderUsage(statusItem, response),
      onUnavailable: showUnavailable,
      onExit: () => {
        if (client !== usageClient) return;
        client = undefined;
        showUnavailable();
        scheduleRetry();
      }
    });
    client = usageClient;

    usageClient.start().catch(() => {
      if (client !== usageClient) return;
      usageClient.dispose();
      client = undefined;
      showUnavailable();
      scheduleRetry();
    });
  };

  connectToCodex();
  context.subscriptions.push(vscode.extensions.onDidChange(connectToCodex));
  context.subscriptions.push({
    dispose: () => {
      disposed = true;
      stopClient();
    }
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
