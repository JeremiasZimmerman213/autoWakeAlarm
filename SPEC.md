# SPEC.md

## 1. Overview
This project is a sleep-triggered alarm MVP for the Amazfit Helio Strap.

The user sets a desired amount of sleep, not a fixed wake time. The app waits for confirmed sleep onset, then sets an on-band alarm for:

`wake_time = detected_sleep_start + desired_sleep_duration`

## 2. Problem
Users do not always fall asleep immediately after getting into bed. A fixed alarm does not account for varying sleep onset latency. This project aims to anchor the alarm to actual detected sleep start.

## 3. Primary user story
As a user, I want to arm the app before bed and choose a target sleep duration, so that my strap wakes me after I have actually slept for that amount of time.

## 4. MVP scope
Included:
- set target sleep duration,
- arm/cancel sleep-based alarm,
- background waiting mode,
- sleep onset retrieval/detection,
- wake time computation,
- on-band alarm scheduling,
- basic visible status,
- lightweight debug logging.

Excluded:
- phone alarm integration,
- cloud sync,
- smart wake window,
- sleep debt logic,
- multi-user support,
- historical dashboards.

## 5. Functional requirements

### FR-1: Duration selection
The user can choose a desired sleep duration.
Initial supported values may be:
- 360 min
- 420 min
- 450 min
- 480 min
- 540 min

### FR-2: Arm
The user can arm the app before going to bed.

On arm:
- save target duration,
- reset previous session state,
- cancel any previous alarm created by this app,
- move to `armed_waiting_for_sleep`.

### FR-3: Sleep detection
The system should detect or retrieve sleep start while armed.

Detection sources:
1. sleep status event, if available,
2. sleep sensor polling/update fallback.

### FR-4: Wake time computation
When sleep start is available:
- compute `wake_time = sleep_start + target_duration`
- persist it
- expose it in state

### FR-5: Alarm scheduling
If `wake_time > now`, schedule one on-band alarm.

Store the alarm ID.

### FR-6: Missed target handling
If the system learns sleep start only after `wake_time <= now`, do not schedule a normal future alarm.
Instead:
- move to `missed_target`,
- expose an explanatory status,
- optionally allow immediate fallback behavior later.

### FR-7: Cancel
The user can cancel the active sleep-based alarm workflow.

On cancel:
- cancel app-created alarm if present,
- clear armed session state,
- move to `idle`.

### FR-8: Restart recovery
If the app/service restarts, persisted state should allow recovery of the active session.

## 6. Non-functional requirements

### NFR-1: Simplicity
The code should stay small and understandable.

### NFR-2: Reliability
Do not create duplicate alarms for one session.

### NFR-3: Observability
Important transitions and computed times should be logged in debug mode.

### NFR-4: Testability
Time math and state machine logic should be testable independent of device APIs.

## 7. State machine

### States
- `idle`
- `armed_waiting_for_sleep`
- `sleep_detected_alarm_scheduled`
- `missed_target`
- `alarm_fired`
- `error`

### Events
- `ARM(durationMinutes)`
- `CANCEL`
- `SLEEP_SIGNAL_RECEIVED`
- `SLEEP_START_CONFIRMED(startTimeMs)`
- `WAKE_TIME_MISSED`
- `ALARM_SCHEDULED(alarmId, wakeTimeMs)`
- `ALARM_FIRED`
- `ERROR(message)`

### Transition summary
- `idle` + `ARM` -> `armed_waiting_for_sleep`
- `armed_waiting_for_sleep` + `SLEEP_START_CONFIRMED`:
  - if `wake_time > now` -> `sleep_detected_alarm_scheduled`
  - else -> `missed_target`
- any active state + `CANCEL` -> `idle`
- `sleep_detected_alarm_scheduled` + `ALARM_FIRED` -> `alarm_fired`
- any state + unrecoverable error -> `error`

## 8. Core data model

```ts
type AppState =
  | { status: "idle" }
  | {
      status: "armed_waiting_for_sleep";
      targetDurationMin: number;
      armedAtMs: number;
    }
  | {
      status: "sleep_detected_alarm_scheduled";
      targetDurationMin: number;
      sleepStartMs: number;
      wakeTimeMs: number;
      alarmId: string | number;
    }
  | {
      status: "missed_target";
      targetDurationMin: number;
      sleepStartMs: number;
      wakeTimeMs: number;
      detectedAtMs: number;
    }
  | { status: "alarm_fired"; wakeTimeMs: number }
  | { status: "error"; message: string };
```

## 9. Acceptance criteria

### AC-1
Given the user arms the app for 480 minutes, when sleep start is confirmed at `T`, then the app computes wake time `T + 480 minutes`.

### AC-2
Given wake time is still in the future, exactly one alarm is scheduled.

### AC-3
Given wake time is already in the past, the app does not schedule a future alarm and moves to `missed_target`.

### AC-4
Given the user cancels while armed or after scheduling, app-created alarm data is removed and state becomes `idle`.

### AC-5
Given the app restarts, previously persisted active session state can be loaded.

## 10. Assumptions to validate on device
These are platform assumptions and must stay isolated:
- sleep event timing,
- shape of sleep start data,
- exact alarm API return type,
- background/service lifecycle behavior,
- whether immediate vibration fallback is permitted and appropriate.

## 11. MVP deliverable
A minimally working Zepp OS project that:
- lets the user choose a sleep target,
- arms the workflow,
- detects sleep start,
- schedules a strap alarm,
- shows status,
- logs enough data to evaluate feasibility.
