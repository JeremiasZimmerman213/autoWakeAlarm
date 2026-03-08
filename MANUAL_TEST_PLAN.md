# MANUAL_TEST_PLAN.md

## Purpose
Manual validation checklist for the current one-page + one-app-service MVP in Zepp simulator/device.

## 1. Launch Setup
1. Open the project in your Zepp toolchain/IDE.
2. Build and run the Mini Program in simulator mode.
3. Confirm `app.json` loads with one page target (`page/index`) and one service target (`app-service/sleep_alarm_service`).

## 2. Basic Page Flow
1. Open the app page.
2. Verify screen shows:
- title
- duration text
- status text
- `Change Duration`, `Arm`, `Cancel` buttons
- debug text block
3. Tap `Change Duration` several times.
4. Confirm duration cycles through `360/420/450/480/540`.

## 3. Arm Flow
1. Tap `Arm`.
2. Confirm status becomes `Waiting for sleep`.
3. Confirm debug text includes:
- state `armed_waiting_for_sleep`
- selected duration
- armed time
4. Close and reopen the page.
5. Confirm armed state is still shown (persistence works).

## 4. Cancel Flow
1. From armed or scheduled state, tap `Cancel`.
2. Confirm status becomes `Not armed`.
3. Confirm debug text returns to idle-style summary.
4. Reopen page and confirm state remains not armed.

## 5. Service/Logs Validation
1. Trigger app service invocation (sleep event/alarm/generic invocation path).
2. Inspect runtime logs for these messages:
- service init raw options
- trigger classification
- persisted state loaded
- sleep info refresh/fetched
- sleep start normalized
- computed wake time
- alarm schedule attempt/result
- alarm cancel attempt/result
- alarm fire handling

## 6. Alarm Scheduling Validation
1. Arm app, then trigger service while state is armed.
2. If normalized sleep start is available and wake time is future:
- verify logs show schedule attempt + success/failure
- verify state transitions to `sleep_detected_alarm_scheduled` on success
3. If wake time is already past:
- verify state becomes `missed_target`
- verify no future alarm is scheduled

## 7. Persistence Validation
1. With each state (`armed_waiting_for_sleep`, `sleep_detected_alarm_scheduled`, `missed_target`), reopen page.
2. Confirm displayed status/debug text matches persisted state.

## 8. Still Requires Real Helio Validation
- Exact sleep system-event payload shape (`event:os.health.sleep_status`).
- `hmUI.setProperty(hmUI.prop.MORE, ...)` behavior across firmware versions.
- Final Zepp build path mapping for `page/index` and `app-service/sleep_alarm_service`.
- Alarm cancel call compatibility (`cancel(id)` vs `cancel({ id })`).
- Sleep data latency/freshness timing on actual device.
