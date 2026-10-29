const assert = require("node:assert/strict");
const test = require("node:test");
const manifest = require("../package.json");
const launch = require("../.vscode/launch.json");
const {
  CRITICAL_COLOR,
  WARNING_COLOR,
  getStatusBarPresentation,
  normalizeThresholds
} = require("../statusBarUsage");

const DEFAULT_THRESHOLDS = { warning: 25, critical: 10 };

function windowWithRemaining(durationMinutes, remaining) {
  return {
    windowDurationMins: durationMinutes,
    usedPercent: 100 - remaining
  };
}

function present(options = {}) {
  return getStatusBarPresentation({
    fiveHourThresholds: DEFAULT_THRESHOLDS,
    weeklyThresholds: DEFAULT_THRESHOLDS,
    ...options
  });
}

test("shows both windows by default with the theme's default foreground", () => {
  const result = present({
    fiveHourWindow: windowWithRemaining(300, 80),
    weeklyWindow: windowWithRemaining(10_080, 60)
  });

  assert.equal(result.text, "$(robot) 5h 80% | w 60%");
  assert.equal(result.color, undefined);
});

test("evaluates the supplied five-hour and weekly readings", () => {
  const result = present({
    fiveHourWindow: windowWithRemaining(300, 8),
    weeklyWindow: windowWithRemaining(10_080, 22)
  });

  assert.equal(result.text, "$(robot) 5h 8% | w 22%");
  assert.equal(result.color, CRITICAL_COLOR);
});

test("F5 development launch does not override Codex usage values", () => {
  assert.equal(launch.configurations[0].env, undefined);
});

test("colors the item orange below the warning threshold", () => {
  const result = present({ fiveHourWindow: windowWithRemaining(300, 24) });

  assert.equal(result.color, WARNING_COLOR);
});

test("colors the item red below the critical threshold", () => {
  const result = present({ fiveHourWindow: windowWithRemaining(300, 9) });

  assert.equal(result.color, CRITICAL_COLOR);
});

test("threshold comparisons are strict", () => {
  const warningBoundary = present({ fiveHourWindow: windowWithRemaining(300, 25) });
  const criticalBoundary = present({ fiveHourWindow: windowWithRemaining(300, 10) });

  assert.equal(warningBoundary.color, undefined);
  assert.equal(criticalBoundary.color, WARNING_COLOR);
});

test("critical status takes precedence when both windows are displayed", () => {
  const result = present({
    fiveHourWindow: windowWithRemaining(300, 9),
    weeklyWindow: windowWithRemaining(10_080, 20)
  });

  assert.equal(result.color, CRITICAL_COLOR);
});

test("shows and evaluates only the selected five-hour window", () => {
  const result = present({
    displayWindows: "fiveHour",
    fiveHourWindow: windowWithRemaining(300, 80),
    weeklyWindow: windowWithRemaining(10_080, 5)
  });

  assert.equal(result.text, "$(robot) 5h 80%");
  assert.equal(result.visibleWeeklyWindow, undefined);
  assert.equal(result.color, undefined);
});

test("shows and evaluates only the selected weekly window", () => {
  const result = present({
    displayWindows: "weekly",
    fiveHourWindow: windowWithRemaining(300, 5),
    weeklyWindow: windowWithRemaining(10_080, 20)
  });

  assert.equal(result.text, "$(robot) w 20%");
  assert.equal(result.visibleFiveHourWindow, undefined);
  assert.equal(result.color, WARNING_COLOR);
});

test("applies independent thresholds to each window", () => {
  const result = present({
    fiveHourWindow: windowWithRemaining(300, 15),
    weeklyWindow: windowWithRemaining(10_080, 15),
    fiveHourThresholds: { warning: 20, critical: 5 },
    weeklyThresholds: { warning: 10, critical: 4 }
  });

  assert.equal(result.color, WARNING_COLOR);
});

test("invalid readings do not trigger a warning color", () => {
  const result = present({
    fiveHourWindow: { windowDurationMins: 300, usedPercent: Number.NaN },
    weeklyWindow: { windowDurationMins: 10_080 }
  });

  assert.equal(result.text, "$(robot) 5h --% | w --%");
  assert.equal(result.color, undefined);
});

test("uses selected window placeholders when readings are unavailable", () => {
  const result = present({ displayWindows: "weekly" });

  assert.equal(result.text, "$(robot) w --%");
  assert.equal(result.color, undefined);
});

test("invalid display modes fall back to both windows", () => {
  const result = present({ displayWindows: "invalid" });

  assert.equal(result.text, "$(robot) 5h --% | w --%");
});

test("normalizes thresholds to percentage bounds", () => {
  assert.deepEqual(normalizeThresholds(120, -5, DEFAULT_THRESHOLDS), {
    warning: 100,
    critical: 0
  });
});

test("falls back to defaults when critical is not below warning", () => {
  assert.deepEqual(normalizeThresholds(10, 25, DEFAULT_THRESHOLDS), DEFAULT_THRESHOLDS);
});

test("manifest exposes the display setting and independent threshold defaults", () => {
  const settings = manifest.contributes.configuration.properties;

  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(settings["codexUsageMonitor.statusBar.displayWindows"].enum, [
    "both",
    "fiveHour",
    "weekly"
  ]);
  assert.equal(settings["codexUsageMonitor.statusBar.displayWindows"].default, "both");
  assert.equal(settings["codexUsageMonitor.statusBar.fiveHourWarningThreshold"].default, 25);
  assert.equal(settings["codexUsageMonitor.statusBar.fiveHourCriticalThreshold"].default, 10);
  assert.equal(settings["codexUsageMonitor.statusBar.weeklyWarningThreshold"].default, 25);
  assert.equal(settings["codexUsageMonitor.statusBar.weeklyCriticalThreshold"].default, 10);
});
