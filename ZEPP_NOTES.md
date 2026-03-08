# ZEPP_NOTES.md

## Purpose
This file is the local Zepp OS knowledge transfer for Codex.

Use it as the source of truth for platform-specific implementation details in this repo.
If code and this file conflict, prefer this file unless real-device testing proves otherwise.

---

## 1. Recommended strategy for this repo

For this project, use a **central Zepp reference file** plus **small prompt-specific reminders**.

Why:
- Codex may not have live internet/docs access during the agent run.
- Zepp details are easy to hallucinate.
- A central file keeps terminology, permissions, and API assumptions consistent.
- Small per-prompt reminders help Codex focus only on the Zepp pieces relevant to the current phase.

Recommended workflow:
1. Keep all stable platform facts in `ZEPP_NOTES.md`.
2. In each Codex prompt, explicitly say:
   - “Use `ZEPP_NOTES.md` as the source of truth for Zepp APIs.”
   - “Do not invent undocumented APIs.”
3. Repeat only the relevant subsection in the prompt when a task depends heavily on Zepp behavior.

---

## 2. App model we should use

Target:
- **Zepp OS Mini Program**
- **Amazfit Helio Strap**
- **on-band alarm**, not phone alarm

High-level architecture:
- one foreground UI page for settings/status,
- one `App Service` for background behavior,
- sleep detection handled by:
  - system event if available,
  - sleep sensor fetch/update as fallback,
- alarm scheduled with `@zos/alarm`,
- session state persisted locally.

---

## 3. app.json facts Codex should assume

Use `app.json` with:
- `configVersion: "v3"`
- required `permissions`
- `module.app-service.services`
- likely `module.app-event.path` if responding to system events

Important permissions for this MVP:
- `device:os.bg_service`
- `device:os.alarm`
- `device:os.local_storage`
- `data:user.hd.sleep`
- `event:os.health.sleep_status` (if we listen for the sleep system event)

Important module shape:
```json
{
  "configVersion": "v3",
  "permissions": [
    "device:os.bg_service",
    "device:os.alarm",
    "device:os.local_storage",
    "data:user.hd.sleep",
    "event:os.health.sleep_status"
  ],
  "module": {
    "app-service": {
      "services": ["app-service/sleep_alarm_service"]
    },
    "app-event": {
      "path": "app-service/sleep_alarm_service"
    }
  }
}
```

Notes:
- The exact page paths/targets still need to match the repo structure.
- Keep permissions minimal.
- If system-event wiring causes build/runtime trouble, keep the service and fall back to polling.

---

## 4. App Service rules

Zepp OS has an `AppService()` global constructor.
Each App Service file must call `AppService()` exactly once.

Important lifecycle:
- `onInit(params?: string)`
- `onDestroy()`

Example shape:
```js
AppService({
  state: {},
  onInit(params) {
    // start work
  },
  onDestroy() {
    // cleanup
  }
})
```

There are two useful service modes:

### A. Single execution service
Can be invoked by:
- alarm
- notification
- system event

Use this for:
- react to an alarm fire
- react to a sleep system event
- perform one short task

### B. Continuous running service
Can be started from the foreground app using `@zos/app-service` `start(...)`.
Use this only if needed.

For MVP:
- Prefer **single execution + persisted state** first.
- Only add continuously running service if needed for reliability.

Potential import names to use carefully:
- `AppService` is a global constructor in the framework docs
- `exit` is from `@zos/app-service`
- `start` is from `@zos/app-service`

Do not assume every example uses identical import style.
Wrap service-control logic in a thin adapter if needed.

---

## 5. Sleep API facts

Use the sleep sensor from:
- `@zos/sensor`

Main object:
- `new Sleep()`

Relevant methods:
```js
const sleep = new Sleep()
sleep.updateInfo()
const info = sleep.getInfo()
```

Permission required:
- `data:user.hd.sleep`

Important warning:
### `startTime` and `endTime` are NOT documented as epoch timestamps.
They are documented as:
- `startTime`: sleep onset time, based on the number of minutes at 0:00 of the day
- `endTime`: sleep end time, based on the number of minutes at 0:00 of the day

That means they are **minutes since local midnight**, not epoch milliseconds.

Relevant fields from `getInfo()`:
```ts
type SleepInfo = {
  score: number
  deepTime: number
  startTime: number   // minutes since 00:00 of the day
  endTime: number     // minutes since 00:00 of the day
  totalTime: number   // minutes
}
```

The docs also say:
- sleep data updates every 30 minutes by default
- `updateInfo()` actively triggers a sleep data update

### Required normalization rule
Internal app logic should use:
- epoch milliseconds for timestamps
- integer minutes for durations

So create a normalization helper like:
```ts
normalizeSleepStartToEpochMs({
  startTimeMinutesFromMidnight,
  referenceNowMs
}) => number | null
```

### Practical conversion note
Because `startTime` is relative to the day, conversion must use a date anchor.

Use this conservative rule:
- construct a local datetime for **today at local midnight + startTime minutes**
- if that produces a time too far in the future relative to `now`, fall back to **yesterday at local midnight + startTime minutes**

This matters because bedtime may cross midnight.

Keep the conversion isolated in one utility function.

---

## 6. Sleep system event facts

There is a documented system event:
- `event:os.health.sleep_status`

To listen to a system event:
1. add the event name to `permissions`
2. configure `module.app-service.services`
3. configure `module.app-event.path`
4. handle the invocation in the App Service `onInit(options/params)`

Important caution:
- The docs confirm the event exists.
- The docs do **not** clearly document the exact payload format for sleep status in the same level of detail as some other events.
- So code should treat incoming params as loosely structured and log them.

Recommended implementation:
- when the service is invoked via system event, log the raw params string
- then fetch normalized sleep info through the `Sleep` sensor
- do not rely only on undocumented event payload fields

---

## 7. Alarm API facts

Use:
- `@zos/alarm`

Relevant methods:
- `set(option)`
- `cancel(id)` or `cancel({ id })`

Permission required:
- `device:os.alarm`

Alarm set facts:
- `time` is a **UTC timestamp in seconds**
- `delay` is in seconds
- one of `time` or `delay` must be provided
- `url` is required and should point to the page or App Service to wake
- `store: true` enables persistent storage across reboot
- return value is a numeric alarm/timer id
- `0` means invalid / creation failed

For this project:
- use **absolute `time`** instead of `delay`
- use **UTC seconds**
- use **`store: true`**
- use a dedicated service path or app path for wake-up handling
- persist the returned alarm id

Suggested scheduling shape:
```js
import { set, cancel } from '@zos/alarm'

const id = set({
  url: 'app-service/sleep_alarm_service',
  time: Math.floor(wakeTimeMs / 1000),
  store: true
})

if (id === 0) {
  // scheduling failed
}
```

Suggested cancel shape:
```js
cancel(id)
```

### Important design rule
The alarm API wakes a path in the Mini Program.
So make alarm handling go through one known service entry path.
Do not scatter multiple alarm destinations unless needed.

---

## 8. Local persistence facts

Use:
- `@zos/storage`
- local storage API

Relevant methods:
```js
localStorage.setItem(key, value)
localStorage.getItem(key, defaultValue)
```

Permission required:
- `device:os.local_storage`

Use storage for:
- current app state
- target duration
- armed timestamp
- normalized sleep start
- computed wake time
- alarm id
- debug log breadcrumbs if needed

Keep persistence wrapper isolated in one module:
- `saveSession`
- `loadSession`
- `clearSession`

---

## 9. Time conventions for this repo

Codex must follow these rules:
- internal timestamps: epoch milliseconds
- Zepp alarm scheduling: UTC seconds
- Zepp sleep `startTime` / `endTime`: minutes from local midnight
- sleep duration target: integer minutes

Never mix these units without explicit conversion helpers.

Minimum helper functions:
```ts
minutesToMs(minutes: number): number
epochMsToUtcSeconds(ms: number): number
computeWakeTimeMs(sleepStartMs: number, durationMin: number): number
normalizeSleepStartToEpochMs(startMinutes: number, nowMs: number): number | null
```

---

## 10. Recommended adapter boundaries

Keep Zepp-specific code in thin adapters.

Suggested files:
- `sleep/sleep-adapter.ts`
- `alarm/alarm-adapter.ts`
- `storage/session-store.ts`
- `service/service-entry.ts`

### sleep adapter responsibilities
- own `Sleep()` instance
- call `updateInfo()` when needed
- call `getInfo()`
- validate fields
- normalize `startTime` to epoch ms
- return internal typed result

### alarm adapter responsibilities
- schedule absolute alarm at wake time
- cancel known alarm id
- convert ms -> UTC seconds
- return normalized success/failure result

### storage responsibilities
- serialize/deserialize app session
- hide raw Zepp storage details

---

## 11. What Codex should NOT assume

Do not assume any of the following unless later verified:
- that sleep event payload contains a reliable start timestamp
- that sleep event fires immediately at real sleep onset
- that sleep start is provided in epoch ms
- that the same API examples work unchanged on every Zepp OS target
- that a phone alarm can be created from this device-side Mini Program
- that background service must always run continuously

---

## 12. Safer implementation pattern for MVP

Preferred sequence:
1. implement pure logic and state machine
2. implement storage adapter
3. implement sleep adapter using `Sleep().getInfo()` + normalization
4. implement alarm adapter using `@zos/alarm`
5. implement App Service entry that:
   - loads state
   - fetches sleep info
   - computes wake time
   - schedules/cancels alarm
6. add system-event integration
7. add optional continuous service only if needed

This keeps the riskiest Zepp assumptions isolated.

---

## 13. Prompting guidance for Codex

For any Zepp-dependent prompt, include this line:

> Use `ZEPP_NOTES.md` as the source of truth for Zepp OS APIs in this repo. Do not invent undocumented APIs. If a detail is uncertain, isolate it behind a thin adapter and add a concise TODO.

For adapter prompts, also include:
- “Keep imports/framework usage minimal.”
- “Normalize all Zepp-specific units before returning.”
- “Log raw service params instead of assuming payload shape.”

---

## 14. Immediate implementation guidance

The first Zepp-specific code Codex should write is probably:
- a typed sleep adapter interface,
- a Zepp-backed sleep adapter implementation,
- a small normalization utility for `startTime`,
- an alarm adapter using `@zos/alarm`,
- an `app.json` scaffold with the necessary permissions/modules.

Do not ask Codex to build the whole Zepp app in one prompt.
