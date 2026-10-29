# 0001: Configurable Status Bar Display and Threshold Colors

**Status:** Implemented for version `1.0.0`

## Summary

Let users choose which Codex usage windows appear in the status bar and configure independent warning and critical thresholds for the five-hour and weekly windows. Use the status bar item's foreground color to indicate the most severe threshold currently crossed by a displayed window.

## Motivation

The extension currently displays the five-hour and weekly remaining percentages in one status bar item. VS Code applies a foreground color to the whole item, so the two percentages cannot have independent text colors while remaining in that single item. A combined color based on the most urgent displayed window keeps the compact layout and makes low remaining usage visible.

## Settings

- `codexUsageMonitor.statusBar.displayWindows`
  - `both` (default)
  - `fiveHour`
  - `weekly`
- `codexUsageMonitor.statusBar.fiveHourWarningThreshold`
  - Default: `25`
- `codexUsageMonitor.statusBar.fiveHourCriticalThreshold`
  - Default: `10`
- `codexUsageMonitor.statusBar.weeklyWarningThreshold`
  - Default: `25`
- `codexUsageMonitor.statusBar.weeklyCriticalThreshold`
  - Default: `10`

Thresholds are remaining-usage percentages from 0 to 100. For each window, the critical threshold must be lower than the warning threshold.
If a window has an invalid threshold pair, that window uses the built-in defaults of 25% warning and 10% critical.

## Color behavior

Evaluate only windows selected by `displayWindows` and only when they have a valid remaining percentage. Each window uses its own warning and critical thresholds.

| Condition for any displayed window | Status item foreground |
| --- | --- |
| Remaining usage is below that window's critical threshold | Red |
| Otherwise, remaining usage is below that window's warning threshold | Orange |
| No displayed window is below a threshold | VS Code theme default |

The most severe state wins when both windows are displayed: critical red takes precedence over warning orange. Comparisons are strict (`<`), so a value equal to a threshold does not cross it. A hidden window does not affect the color. If no displayed window has a valid reading, use the default theme foreground.

The color applies to the entire status bar item, including its icon and all displayed text. Keep the percentages and tooltip details available so color is an additional signal rather than the only one.

## Acceptance criteria

- Users can show only the five-hour window, only the weekly window, or both; the default is both.
- Users can set separate warning and critical thresholds for each window.
- Invalid threshold pairs fall back to that window's default thresholds (`25` warning and `10` critical).
- The single status bar item uses the most severe applicable color among the displayed windows and returns to the theme default when no threshold is crossed.
- Missing or invalid readings do not trigger a warning color.

## Lifecycle

This proposal was moved from `docs/ideas/` after implementation.
