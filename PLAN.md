# PLAN.md

## Goal
Build the smallest useful MVP first, while reducing platform risk early.

## Phase 0: Repo bootstrap
Create the initial repository shape.

Suggested structure:

```text
src/
  app.ts
  ui/
    main-page.ts
  service/
    app-service.ts
  core/
    state-machine.ts
    orchestrator.ts
    types.ts
  sleep/
    sleep-adapter.ts
    sleep-parser.ts
  alarm/
    alarm-adapter.ts
  storage/
    session-store.ts
  debug/
    logger.ts
  utils/
    time.ts
tests/
docs/
```

Deliverables:
- folder structure,
- placeholder modules,
- shared types,
- logger,
- time utilities.

## Phase 1: State machine and pure logic
Implement all device-agnostic logic first.

Tasks:
1. Define `AppState` and event types.
2. Implement transition reducer/state machine.
3. Implement time math utility:
   - `computeWakeTime(startMs, durationMin)`
   - `isWakeTimeInFuture(wakeTimeMs, nowMs)`
4. Implement session serialization shape.
5. Add unit tests for pure logic.

Deliverables:
- compilable pure core,
- tests for state transitions and wake time math.

## Phase 2: Device adapters
Create thin wrappers for Zepp APIs.

Tasks:
1. `sleep-adapter.ts`
   - subscribe to sleep-related trigger if supported,
   - fetch sleep info,
   - normalize output to internal types.
2. `alarm-adapter.ts`
   - schedule alarm,
   - cancel alarm,
   - normalize alarm ID.
3. `session-store.ts`
   - save/load/clear session.

Rules:
- keep all SDK-specific behavior here,
- return normalized internal objects,
- add TODO comments where behavior depends on device validation.

Deliverables:
- minimal adapters with typed interfaces.

## Phase 3: Background orchestration
Implement the app service that coordinates behavior.

Tasks:
1. Load persisted session on start.
2. Resume waiting mode if armed.
3. Subscribe to sleep signal.
4. On signal:
   - fetch normalized sleep info,
   - confirm `startTime`,
   - compute wake time,
   - schedule alarm or mark missed target,
   - persist updated state.
5. Guard against duplicate processing.

Deliverables:
- one orchestrator path from arm -> detect -> schedule.

## Phase 4: UI
Implement a very small UI.

Tasks:
1. show current status,
2. select target duration,
3. arm,
4. cancel,
5. optionally show:
   - detected sleep time,
   - computed wake time.

Deliverables:
- minimal page with basic control and status.

## Phase 5: Feasibility logger mode
Add instrumentation for real-device validation.

Log:
- arm time,
- sleep signal receipt time,
- sleep start time from device,
- wake time,
- alarm scheduling result.

Deliverables:
- developer-readable logs,
- optional toggle or constant for verbose mode.

## Phase 6: Manual device test plan
Run real-device scenarios.

Test scenarios:
1. arm and verify persistence,
2. simulate or observe sleep event,
3. confirm wake time math,
4. verify alarm creation,
5. verify cancel works,
6. verify no duplicate alarms,
7. verify restart recovery,
8. verify missed-target behavior.

## Implementation order
Codex should follow this order unless blocked:
1. core types
2. time utils
3. state machine
4. logger
5. storage
6. sleep adapter
7. alarm adapter
8. orchestrator/service
9. UI
10. tests and cleanup

## Definition of done for MVP
The MVP is done when:
- code compiles,
- the user can arm a sleep-duration alarm,
- sleep start can be retrieved/detected,
- wake time is computed correctly,
- a strap alarm is scheduled when appropriate,
- duplicate alarms are prevented,
- status is visible,
- core logic is documented.

## Known risks
- real timing of sleep updates,
- event availability on Helio Strap,
- service lifetime,
- alarm API quirks.

## Risk mitigation
- keep adapters thin,
- preserve fallback polling path,
- make logger mode first-class,
- keep the system understandable and debuggable.

## Codex tasking guidance
When asking Codex to work, keep prompts narrow and sequential.
Good task chunk examples:
- “Implement types and pure time utils.”
- “Add the reducer/state machine and tests.”
- “Create a sleep adapter interface with a Zepp-backed implementation.”
- “Wire the service orchestration using the adapters.”

Avoid asking for the whole app in one prompt.
