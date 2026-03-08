# Helio Sleep Alarm MVP

A small Zepp OS MVP for the Amazfit Helio Strap.

The idea is simple: instead of setting an alarm for a fixed clock time, the user sets a desired amount of sleep. Once sleep onset is detected, the app schedules an on-band alarm for:

`detected_sleep_start + desired_sleep_duration`

## Documents
- `AGENTS.md` — coding rules, priorities, and project guardrails for Codex
- `SPEC.md` — product and technical specification
- `PLAN.md` — implementation sequence and delivery plan

## MVP
- target device: Amazfit Helio Strap
- platform: Zepp OS
- alarm target: strap vibration
- one active sleep-based alarm at a time

## Current status
Documentation bootstrap only.
Implementation should begin with pure logic and adapters, then background orchestration, then UI.

## Zepp Target Note
- `app.json` is currently pinned to simulator target `Amazfit Active 2 (Square)` (`deviceSource` values `10223872`, `10223873`, `10223875`) for local `zeus dev` compatibility.
- To switch later (for Helio or another watch), update:
  - `targets.<target-name>.platforms`
  - `targets.<target-name>.designWidth`
  - `runtime.apiVersion` if device API support differs.

## Zeus Runtime Files
- Zeus packages root runtime JS entry files:
  - `app.js`
  - `page/index.js`
  - `app-service/sleep_alarm_service.js`
- TypeScript source remains under `src/`.
- Runtime JS is emitted from `src/` into root Zepp folders with:
  - `./node_modules/.bin/tsc -p tsconfig.zeus-runtime.json`
