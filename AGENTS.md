# AGENTS.md

## Project
Sleep-triggered alarm MVP for the Amazfit Helio Strap on Zepp OS.

## Mission
Build a minimal, reliable MVP that lets a user:
1. choose a desired sleep duration,
2. arm the app before bed,
3. detect sleep onset from band sleep data,
4. schedule an on-band alarm for `sleep_start + desired_duration`.

This repository exists to help validate platform feasibility first, then ship a working MVP.

## Product constraints
- MVP target device: **Amazfit Helio Strap**
- Platform: **Zepp OS Mini Program / App Service**
- Alarm target: **strap vibration alarm**, not phone alarm
- Manual arming before bed is acceptable
- Only one active sleep-based alarm at a time
- Fixed-duration sleep target only; no smart wake window in v1

## Success criteria
A successful MVP:
- stores a target sleep duration,
- runs in the background after the user arms it,
- detects or retrieves sleep start time,
- computes the wake time correctly,
- schedules a strap alarm if the wake time is still in the future,
- exposes clear status to the user.

## Non-goals for v1
Do not implement these unless explicitly asked:
- phone-native alarm integration,
- cloud sync,
- advanced analytics,
- multi-night history UI,
- sleep cycle optimization,
- automatic bedtime suggestion,
- account/auth systems,
- polished design work.

## Engineering priorities
When making tradeoffs, optimize in this order:
1. Correctness
2. Simplicity
3. Reliability
4. Observability
5. UX polish

## Required architecture shape
Keep the code split into these logical areas:
- `ui/` for user-facing screens
- `service/` for background behavior
- `sleep/` for sleep detection and parsing
- `alarm/` for alarm scheduling/canceling
- `storage/` for persisted state
- `core/` for types, state machine, orchestration
- `debug/` for logging and feasibility instrumentation

## State model
Use explicit states, not scattered booleans.

Recommended states:
- `idle`
- `armed_waiting_for_sleep`
- `sleep_detected_alarm_scheduled`
- `missed_target`
- `alarm_fired`
- `error`

Transitions must be centralized in one place.

## Implementation rules
- Prefer small pure functions for time math and validation.
- Keep Zepp/SDK-specific code in thin adapters.
- Do not duplicate business logic between UI and background service.
- Persist enough state for restart recovery.
- Track the created alarm ID so it can be replaced/canceled safely.
- Avoid hidden global state.
- Add lightweight logs around every important state transition.

## Observability requirements
Every meaningful event should be loggable:
- user armed app
- target duration saved
- sleep event received
- sleep info fetched
- sleep start parsed
- wake time computed
- alarm scheduled
- alarm canceled
- target already passed
- alarm fired
- error encountered

## Time handling rules
- Store timestamps in epoch milliseconds internally.
- Keep duration in minutes internally.
- Put all time math in one utility module.
- Never scatter ad hoc date arithmetic throughout the codebase.

## Error handling rules
Handle these explicitly:
- sleep data unavailable
- missing sleep start time
- duplicate event reception
- wake time already in the past
- alarm scheduling failure
- persistence failure

Errors should degrade gracefully and update visible status when possible.

## Feasibility-first approach
Before polishing, validate the riskiest assumptions:
1. Can we detect sleep reliably enough?
2. How early does sleep start become available?
3. Can the app service survive long enough to schedule the alarm?
4. Does the alarm fire reliably on the device?

Any implementation should preserve the ability to run a “logger mode” for validation.

## Expected deliverables
Codex should help produce:
- a small working codebase,
- a logger/feasibility mode,
- core documentation,
- clean pseudocode-to-code mapping,
- a testable MVP path.

## What Codex should avoid
- inventing SDK APIs without marking them as assumptions,
- adding unnecessary frameworks,
- overengineering abstractions,
- mixing speculative platform behavior into core logic without a TODO,
- silent failures.

## If uncertain
When Zepp OS API behavior is unclear:
- isolate the uncertainty behind a small adapter,
- leave a concise TODO,
- prefer code that is easy to swap once real-device behavior is confirmed.
