# Prompt 07 — Agenda multi-staff UI: day columns, staff chips, week colors

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.D, §2.4 agenda UX + why columns win on iPad, §2.3). That report + this file are your only context. `FE:` = `frontend/src/`, `BE:` = `backend/src/main/java/daviderocca/beautyroom/`.

## Objective (one concern)

The admin agenda **renders** multiple staff — read-only with respect to staff (assignment editing arrives in prompt 08). Day view becomes per-staff columns when ≥2 active staff; week view gains per-staff color + filter chips. With 1 active staff, both views are **pixel-identical to today** (I1).

## In scope
- **DTO (backend, minimal):** `BE:DTO/bookingDTOs/AdminBookingCardDTO.java` gains `staffId` + `staffName` (+ `staffColor` if you prefer one source of truth). ⚠️ **Positional record, ~47 components, exactly ONE construction site** (`BookingService.toAdminCard` ≈3450) — append at the end, update that site, run `test-compile`. The agenda-day repository query must not go N+1: booking→staff is LAZY; map name/color via a join fetch or a scalar in the existing query — check how `toAdminCard` loads associations and follow the same pattern. `PersonalAppointmentDTO` already carries `staffId` (prompt 03).
- **Staff roster source:** the workspace fetches `GET /admin/staff` once (or a lighter active-list if you add one — prefer reusing 03's endpoint) → `{id, displayName, color, sortOrder, active}`; derive `activeStaff` and the I1 gate `activeStaff.length >= 2` in ONE hook (`FE:hooks/useActiveStaff.js`) — every conditional in this epic's FE keys off this hook.
- **Day view (`FE:components/admin/AdminAgendaPage.jsx`):**
  - Gate OFF (1 staff): current single-column markup untouched (render the exact same tree — guard at the wrapper level, not by styling columns to look single).
  - Gate ON: one column per active staff, sharing the single time-axis gutter; bookings/PAs grouped by `staffId` (unknown/NULL → first column + console-free WARN badge); closures with `staffId NULL` span all columns, staff closures only theirs; now-line spans all columns. Header chips (name + color dot) above columns; tapping a chip focuses that staff (single-column mode), tapping again returns to all. ≥4 staff: horizontal scroll on the columns wrapper with `data-lenis-prevent` and sticky header chips.
  - Reuse the existing %-of-24h positioning math per column verbatim — columns change the container width, not the math.
- **Week view (`FE:components/admin/WeeklyCalendar.jsx`):** merged layout stays; blocks get a left color stripe per staff; the same staff chips filter the week; per-day PA/booking counts unchanged when gate OFF.
- **Card/selection UI:** selected-booking detail card shows the staff name (small badge with color dot).

## Out of scope
Drawer changes / staff picker / moving bookings between staff (08). Any availability call changes (the drawer owns those — 08). Backend beyond the DTO field mapping. Public flows. Timeline `DayTimelineDTO` per-staff open-ranges rendering (optional polish: if trivially available via `staffId` param from 06, you may render per-column open ranges; otherwise keep the union frame and note it).

## Context budget
1. `FE:components/admin/AdminAgendaPage.jsx` (grep for: `ag-tl-booking`, `ag-tl-personal`, `ag-tl-closure`, the day-fetch effect, geometry helpers `toPct`/scale) — read targeted regions, the file is ~1800 lines.
2. `FE:components/admin/WeeklyCalendar.jsx`.
3. `FE:features/admin/AdminWorkspace.jsx` (where to fetch the roster once + context).
4. The agenda API module (grep `getBookingsDay|getTimelineDay|getPersonalAppointmentsDay` under `FE:`).
5. `BE:DTO/bookingDTOs/AdminBookingCardDTO.java` + `BookingService.toAdminCard` region (≈3450) + the day/range repo query it feeds.
6. Agenda CSS file(s) for `.ag-tl-*` classes.

## Preconditions — STOP rules
- Prompts 01–06 merged (staff on cards' rows exists; roster API exists). Verify `AdminBookingCardDTO` has no staff field yet; if it does, STOP (done already?).
- `grep -c "new AdminBookingCardDTO(" backend/src/main/java` must be 1. If >1, update ALL sites and note it.
- If the day-view geometry is not %-based as described (§1.D), STOP and re-derive before restructuring.

## Ordered steps
1. Backend DTO field + mapping + `test-compile` (verify no N+1: check SQL logs or the query shape).
2. `useActiveStaff` hook + roster fetch in the workspace shell.
3. Day view columns behind the gate; chips; grouping; closures spanning.
4. Week stripes + chips.
5. iPad smoke via dev server at 1024×768 and 1366×1024 (landscape/portrait): with a second fake ACTIVE staff (created via Team UI), verify columns, chips focus, horizontal scroll with `data-lenis-prevent`, then deactivate the staff and verify pixel-identical single-staff rendering.

## Landmines
- Opacity-only transitions in the workspace (existing `.aw-fade` convention) — don't animate layout.
- `data-lenis-prevent` on the horizontally scrollable columns wrapper (CLAUDE.md/Lenis rule).
- Don't wrap Bootstrap cols in `motion.div` directly.
- CSS: `.ag-*` classes are shared — scope new styles (`.ag-tl--multi` modifier) so single-staff rendering keeps existing selectors untouched.
- No new npm deps; no `console.log`.

## Acceptance criteria
- Gate OFF: DOM/visual parity with today (compare snapshots/manually).
- Gate ON: every booking/PA appears exactly once, in its staff's column; global closures span; per-staff closures don't leak; chips focus works; week stripes match staff colors.
- Backend: 1-construction-site rule respected; day query count unchanged (no N+1).

## Test gate
`./mvnw -q test-compile && ./mvnw -q test` green; `npm run build` green; eslint clean on changed files (3 repo-wide pre-existing errors are known).

## Expected diff size
FE ≈ +600/−80 across 4 files + CSS; BE ≈ +15/−5. Largest FE prompt with 08.

**MERGE CHECKPOINT: yes** (gate OFF ⇒ identical; gate can only turn ON if Michela activates a second staff, which she won't until the epic completes).
**Recommended model/effort:** strong @ high — iPad-critical UI on a performance-sensitive component.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
