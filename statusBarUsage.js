const WARNING_COLOR = "#f59e0b";
const CRITICAL_COLOR = "#ef4444";

function remainingPercentValue(window) {
  const usedPercent = window?.usedPercent ?? window?.used_percent;
  if (typeof usedPercent !== "number" || !Number.isFinite(usedPercent)) return undefined;
  return Math.max(0, Math.min(100, 100 - usedPercent));
}

function remainingPercent(window) {
  const remaining = remainingPercentValue(window);
  return remaining === undefined ? "--%" : `${Math.round(remaining)}%`;
}

function normalizeThresholds(warning, critical, defaults) {
  const clamp = (value, fallback) => typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
  const normalizedWarning = clamp(warning, defaults.warning);
  const normalizedCritical = clamp(critical, defaults.critical);
  return normalizedCritical < normalizedWarning
    ? { warning: normalizedWarning, critical: normalizedCritical }
    : defaults;
}

function getStatusBarPresentation({
  fiveHourWindow,
  weeklyWindow,
  displayWindows = "both",
  fiveHourThresholds,
  weeklyThresholds
}) {
  const mode = ["both", "fiveHour", "weekly"].includes(displayWindows) ? displayWindows : "both";
  const visibleFiveHourWindow = mode !== "weekly" ? fiveHourWindow : undefined;
  const visibleWeeklyWindow = mode !== "fiveHour" ? weeklyWindow : undefined;
  const parts = [];
  if (visibleFiveHourWindow) parts.push(`5h ${remainingPercent(visibleFiveHourWindow)}`);
  if (visibleWeeklyWindow) parts.push(`w ${remainingPercent(visibleWeeklyWindow)}`);

  if (parts.length === 0) {
    if (mode !== "weekly") parts.push("5h --%");
    if (mode !== "fiveHour") parts.push("w --%");
  }

  const fiveHourRemaining = remainingPercentValue(visibleFiveHourWindow);
  const weeklyRemaining = remainingPercentValue(visibleWeeklyWindow);
  const isCritical = (fiveHourRemaining !== undefined && fiveHourThresholds && fiveHourRemaining < fiveHourThresholds.critical) ||
    (weeklyRemaining !== undefined && weeklyThresholds && weeklyRemaining < weeklyThresholds.critical);
  const isWarning = (fiveHourRemaining !== undefined && fiveHourThresholds && fiveHourRemaining < fiveHourThresholds.warning) ||
    (weeklyRemaining !== undefined && weeklyThresholds && weeklyRemaining < weeklyThresholds.warning);

  return {
    text: `$(robot) ${parts.join(" | ")}`,
    color: isCritical ? CRITICAL_COLOR : isWarning ? WARNING_COLOR : undefined,
    visibleFiveHourWindow,
    visibleWeeklyWindow
  };
}

module.exports = {
  CRITICAL_COLOR,
  WARNING_COLOR,
  getStatusBarPresentation,
  normalizeThresholds,
  remainingPercent,
  remainingPercentValue
};
