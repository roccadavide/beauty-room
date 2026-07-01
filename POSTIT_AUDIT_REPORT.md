# Post-it → Admin Workspace: Integration + Redesign Audit (READ-ONLY)

_Status: audit only. No source file, migration, config, or dependency was changed. All findings are anchored to symbol names and verbatim string literals, not line numbers._

## Executive summary

**Yes — this is a clean single-prompt implementation, and it's ~90% frontend.** The audit's biggest surprise: the data model the brief assumed we'd need to *add* **already exists end-to-end**. The `PostIt` entity, `V14__create_post_its.sql`, and `PostItDTO` already carry `priority` (int), `dueDate` (LocalDate), `done` (boolean), and `createdAt`/`updatedAt`. The frontend `PostItBoard.jsx` already renders a 0–3 star priority selector, a due-date field, overdue/expiring color states (`isOverdue`/`isExpiring`), and there's already a `GET /admin/post-its/expiring-count` endpoint feeding the NavBar badge. **No migration is required for the core feature**, and **there is no positional-record landmine** (`PostItDTO` is a Lombok `@Data` class, entity built via `new PostIt()` + setters — one construction site). So the "Flyway V82 collision" and "records-in-lockstep" landmines from the brief are **moot for the core work**. The real work is a frontend refactor: extract the board's grid+drawer into a panel that mounts as a 3rd view inside `AdminWorkspace`, add a `SEGMENTS` entry + fix the 2-segment pill CSS to 3 segments, wire an overdue badge on the tab, restyle the cards into a "whiteboard", and repoint/redirect the two NavBar entries (following the exact `ClientiPage → ClientiRedirect` precedent already in this repo). **Single biggest risk:** extracting `PostItBoard.jsx` (a full-page component) into a shell-less panel without duplicating the page chrome **and** keeping the drawer's `position: fixed` correct once it lives under `AdminWorkspace` — mitigated by portaling the drawer to `document.body`.

---

## A. Current Post-it implementation — full map

### Backend

**Entity — `PostIt.java`** (`entities/PostIt.java`), `@Entity @Table(name = "post_its")`, Lombok `@Getter @Setter @NoArgsConstructor`. Fields verbatim:

| Field | Java type | Mapping |
|---|---|---|
| `id` | `UUID` | `@Id @GeneratedValue` |
| `title` | `String` | `@Column(nullable = false, length = 200)` |
| `description` | `String` | `@Column(columnDefinition = "TEXT")` |
| `color` | `String` | `@Column(nullable = false, length = 7)`, default `"#b8976a"` |
| `dueDate` | `LocalDate` | `@Column(name = "due_date")`, nullable |
| `done` | `boolean` | `@Column(nullable = false)`, default `false` |
| `priority` | `int` | `@Column(nullable = false)`, default `0` |
| `createdAt` | `LocalDateTime` | `@Column(name = "created_at", nullable = false, updatable = false)` |
| `updatedAt` | `LocalDateTime` | `@Column(name = "updated_at", nullable = false)` |

Lifecycle: `@PrePersist onCreate()` (sets both timestamps), `@PreUpdate onUpdate()` (sets `updatedAt`). **No lazy associations** (no `@OneToMany`/`@ManyToOne`) → open-in-view=false is a non-issue here.

**DTO — `PostItDTO.java`** — **Lombok `@Data` class, NOT a record.** Fields: `title` (String), `description` (String), `color` (String), `dueDate` (LocalDate), `priority` (Integer). Omits `done`, `id`, timestamps (read-only server side). Built by JSON deserialization + setters. **Verified: no `new PostItDTO(...)` anywhere in `backend/src`.**

**Repository — `PostItRepository extends JpaRepository<PostIt, UUID>`**:
- `findAllByOrderByDoneAscPriorityDescCreatedAtDesc()`
- `findByDueDateLessThanEqualAndDoneFalse(LocalDate date)`

**Service — `PostItService`**: `findAll()` (no `@Transactional`), `countExpiring()` (no `@Transactional`; `findByDueDateLessThanEqualAndDoneFalse(LocalDate.now()).size()`), and `@Transactional`-annotated `create(PostItDTO)`, `update(UUID, PostItDTO)`, `toggleDone(UUID)`, `delete(UUID)` (hard delete). Private `applyDTO(PostIt, PostItDTO)` copies non-null fields with trim.

**Controller — `PostItController`**, `@RestController @RequestMapping("/admin/post-its") @PreAuthorize("hasRole('ADMIN')")`:
- `GET /admin/post-its` → `List<PostIt>`
- `GET /admin/post-its/expiring-count` (`@GetMapping("/expiring-count")`) → `Map.of("count", …)`
- `POST /admin/post-its` → `201 CREATED`
- `PUT /admin/post-its/{id}`
- `PATCH /admin/post-its/{id}/done`
- `DELETE /admin/post-its/{id}` → `204`

**`V14__create_post_its.sql`**: table `post_its` — `id UUID NOT NULL DEFAULT gen_random_uuid()`, `title VARCHAR(200) NOT NULL`, `description TEXT`, `color VARCHAR(7) NOT NULL DEFAULT '#b8976a'`, `due_date DATE`, `done BOOLEAN NOT NULL DEFAULT FALSE`, `priority INT NOT NULL DEFAULT 0`, `created_at TIMESTAMP NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMP NOT NULL DEFAULT NOW()`; `CONSTRAINT pk_post_its PRIMARY KEY (id)`; partial index `idx_post_its_due ON post_its (due_date) WHERE done = FALSE`.

### Frontend

**Page — `PostItBoard.jsx`** (`pages/admin/PostItBoard.jsx`), default export, **lazy-loaded** at route `/admin/post-it` under `<PrivateRoute roles={["ADMIN"]}>` + `<PageTransition>`. State: `postIts`, `drawerOpen`, `editingId`, `filter` ("active"|"done"|"all"), `form` = `{ title, description, color, dueDate, priority }`, `EMPTY_FORM`, `PALETTE` (8 swatches). Uses all 6 API functions. Helpers `isOverdue`, `isExpiring`, `fmtDate`. Header shows an inline expiring alert. Drawer form uses the shared `DateTimeField` for the due date + 0–3 star buttons + color swatches. **The drawer is inline `position: fixed`; it does NOT use `createPortal`** (verified — no `createPortal`/`react-dom` import in the file).

**API — `postits.api.js`**, `BASE = "/admin/post-its"`: `fetchPostIts` (GET), `fetchExpiringCount` (GET `/expiring-count`, returns `data.count ?? 0`), `createPostIt` (POST), `updatePostIt` (PUT `/{id}`), `togglePostItDone` (PATCH `/{id}/done`), `deletePostIt` (DELETE `/{id}`).

**CSS — `_postit.css`**, prefix **`.pib-`**. Key classes: `.pib-page` (bg `#fffdf8`, min-height `100dvh` — ⚠ uses `dvh`, see §D), `.pib-grid` (`repeat(auto-fill, minmax(240px, 1fr))`, gap `1.25rem`), `.pib-note` (white, radius `16px`, warm shadow `rgba(46,33,24,…)`, hover `translateY(-4px) rotate(-0.5deg)`), `.pib-note--done` / `--overdue` / `--expiring`, `.pib-note-band`, `.pib-note-hole`, `.pib-note-priority` (absolute top-right stars), `.pib-note-body` (title+desc), `.pib-note-title` (Petrona), `.pib-note-desc`, `.pib-note-due` (`--overdue` red `#c0392b`, `--expiring` orange `#b45309`), `.pib-note-actions`, `.pib-drawer-overlay`/`.pib-drawer` (`position: fixed`, z 1040/1050), form classes `.pib-form-*`, `.pib-priority-stars`, `.pib-star`, `.pib-color-*`. **Already fully on Editorial Beauty tokens** (`#fffdf8`, `#b8976a`, `#8c6d3f`, Petrona/SaolDisplay, warm shadows, 16–20px radii).

### Data-model as-is — verdict

| Concept the brief wanted | Already present? |
|---|---|
| **priority** | ✅ `priority int` (entity, DTO, V14, FE star selector) |
| **due/expiry date** | ✅ `dueDate`/`due_date DATE` (entity, DTO, V14, FE + overdue/expiring states) |
| **completed / done** | ✅ `done boolean` + `PATCH …/done` + FE filter tabs |
| **created/updated timestamps** | ✅ `createdAt`/`updatedAt` |
| **overdue count endpoint** | ✅ `GET /admin/post-its/expiring-count` |
| explicit stored "expired"/"archived" flag | ❌ (derived from `dueDate` + `done` — correct by design, don't add) |

**Nothing in the core feature requires a new column, DTO field, or migration.**

---

## B. The agenda view-switch — integration point

- **Route**: `AdminWorkspace` is lazy-loaded and mounted at **`/profilo/admin/agenda`** under `<PrivateRoute roles={["ADMIN"]}>`. **This route is NOT wrapped in `PageTransition`** (unlike `/admin/post-it`).
- **State**: driven by a `?view=` URL param via `useSearchParams`. Source of truth is `WorkspaceContext` (`{ view, setView }`, `useWorkspace()`). `view = searchParams.get("view") === "clienti" ? "clienti" : "agenda"` — default `"agenda"` keeps the URL clean. `setView` preserves other params (e.g. `customerId`). A deep-link `…/agenda?view=clienti` already exists in `App.jsx`.
- **Switch — `WorkspaceSwitch.jsx`**: renders `SEGMENTS = [{ key: "agenda", label: "Agenda" }, { key: "clienti", label: "Clienti" }]` as `role="tab"` buttons (`.wsw__seg`, active `.is-active` + `✦` `.wsw__mark`), with a sliding indicator `.wsw__pill` (`transform: translateX(activeIndex * 100%)`). Arrow-key nav is modulo `SEGMENTS.length`.
- **Mount — `AdminWorkspace.jsx`**: `AdminAgendaPage` and `ClientsHub` are `lazy()` (code-split). Exactly **one** view mounts at a time — `<div key={view} className="aw-fade">{ view === "agenda" ? <AdminAgendaPage/> : <ClientsHub .../> }</div>` inside `<Suspense>`. `key={view}` re-triggers the `.aw-fade` opacity animation; the inactive view **unmounts** (its intervals/fetches stop, its fixed elements clear). `.aw-topbar[data-view=…]` holds a per-view gradient.
- **Where the 3rd view slots in**: extend `SEGMENTS` with `{ key: "postit", label: "Post-it" }`; extend the ternary to a 3-way (`view === "agenda" ? … : view === "clienti" ? … : <PostItPanel/>`); update the default-derivation line to accept `"postit"`; `lazy()`-import the new panel. Adding a 3rd view **does not regress** the existing two — hard-swap + `lazy` isolation means agenda/clients are untouched.
- **Pill CSS is 2-segment-hardcoded** (`.wsw` `grid-template-columns: 1fr 1fr`, `.wsw__pill { width: calc(50% - 4px) }`). **Must become 3-up** (`1fr 1fr 1fr` and `calc(33.333% - 4px)`), else the pill mis-tracks. This is the one non-trivial CSS edit in the switch.
- **Badge source** — recommended: **frontend-derived, lifted into `AdminWorkspace`.** `AdminWorkspace` fetches the count on mount (reuse `fetchExpiringCount()` — no new backend) and passes it to `WorkspaceSwitch` for the `postit` tab; the panel calls a passed-down refetch callback after create/toggle/delete so the badge stays live (the standalone endpoint won't auto-update otherwise). Lower risk than a new aggregate endpoint, and reuses the exact NavBar pattern. The switch renders **no** badge today, so a small new `.wsw__badge` class is needed (can copy `.nav-postit-badge`'s look: `#c0392b`/`#fff`, `min-width:18px`, `border-radius`, `font-weight:700`). See §B note on semantics.
- **Editorial Beauty tokens confirmed in `_workspace.css`**: `.wsw` cream gradient `#fffaf2→#f3e7d4`, border `rgba(139,109,63,.3)`, warm shadow `rgba(140,109,63,.18)`; `.wsw__pill` gold gradient `#c4a373→#8c6d3f`; font `var(--font-display)` (Saol Display Light); radii `999px`; reduced-motion guard present.

**Badge-semantics note:** `expiring-count` = `due_date <= today AND done=false` — i.e. **overdue *or* due-today**. The brief says the badge = "overdue/expired". Decide: reuse this `<=today` semantics (matches the existing NavBar badge — recommended for consistency) **or** strict overdue (`dueDate.isBefore(today)`). Either is a one-line decision; document it.

---

## C. Data-model gap analysis

**For the core feature: no gap, no migration, no DTO change, no record-lockstep risk.**

- **Flyway**: highest existing is **`V81__add_settled_at_to_bookings.sql`**; **no `V82` exists** (verified by directory listing). If (and only if) an *optional extra* needs a new column (e.g. `pinned`, `archived_at`, `customer_id` FK, `snooze`), the next slot is **`V82__snake_case.sql`**. A duplicate version boot-breaks Flyway ("Detected resolved migrations with the same version"). **Do not pre-create it.**
- **Positional-record landmine: N/A.** `PostItDTO` is a `@Data` class (setter-built), and the entity is built via `new PostIt()` + `applyDTO` — the **single** construction site is `PostItService.create()`. No test constructs either type positionally (`new PostItDTO(` → 0 hits). Adding a field later would be additive and would **not** break `test-compile`.
- **`@Transactional(readOnly = true)`**: not required — `PostIt` has no lazy associations, so no read path lazy-loads anything.
- **Priority representation**: **keep `int`** (already indexed by the sort query `…OrderBy…PriorityDesc…`; enum can come later if HIGH/MED/LOW semantics harden). The FE maps int→stars/label/color.
- **Overdue computation**: **derive, never store.** `dueDate != null && dueDate.isBefore(today) && !done`. Single source of truth; no stale flag.
- **Timezone**: canonical constant is **`AvailabilityService.BUSINESS_ZONE = ZoneId.of("Europe/Rome")`** (public static final; also duplicated privately in `ClosureReminderScheduler`). **`PostItService.countExpiring()` currently uses bare `LocalDate.now()` (system TZ) — a latent bug**: on a UTC server it drifts up to ~2h from business reality. If we lean on this endpoint for the tab badge, change it to `LocalDate.now(AvailabilityService.BUSINESS_ZONE)` (1 line). On the FE, the browser TZ on Michela's Italian iPad is already Europe/Rome, so an FE-derived badge is unaffected in practice.

---

## D. Redesign feasibility (frontend / CSS)

The board is **already** on Editorial Beauty tokens, so the "whiteboard" restyle is **CSS-and-markup-order only, LOW risk**, all inside the `.pib-` prefix:

- **Bigger cards**: `.pib-grid` `minmax(240px, 1fr)` → `minmax(300–340px, 1fr)`; consider slightly larger `gap`.
- **Title + description lower**: make `.pib-note` a flex column with a top spacer / `justify-content` so `.pib-note-body` sits mid/lower; increase card min-height. Pure layout, no data change. (The decorative `.pib-note-hole` + `.pib-note-band` already read like a pinned sticky.)
- **Prominent due-date chip**: `.pib-note-due` is currently tiny footer text — promote it to a pill (bg, `border-radius: 12–16px`, larger font, padding), keep the `--overdue` (red `#c0392b`) / `--expiring` (amber `#b45309`) modifiers. Add an explicit **"scade il {fmtDate}"** / **"scaduto"** label. Markup can stay; mostly CSS.
- **Priority selector (touch-robust, iPad)**: the on-card `.pib-note-priority` is currently a read-only absolute display; the editable star control lives in the drawer. For a whiteboard, either (a) keep editing in the drawer (simplest, zero new handlers), or (b) add an on-card segmented/stepper priority control with **≥44px touch targets** and `onClick` that `stopPropagation()`s so it doesn't open the card. Prefer (a) for the first pass; (b) as a follow-up. No hover-only affordances.

**CSS landmines to respect:**
- **`svh` not `vh`/`dvh`**: `.pib-page` uses `min-height: 100dvh`. When the board becomes a panel *inside* `AdminWorkspace`, drop the full-page `min-height` entirely (the panel inherits the workspace's height). If any full-height rule remains, use `svh`.
- **Drawer / `position: fixed`**: `.pib-drawer`/`.pib-drawer-overlay` are inline `position: fixed`, **not portaled**. `/profilo/admin/agenda` is **not** under `PageTransition`, and `.aw-fade` is **opacity-only** (no transform/filter/will-change — enforced by comment in `_workspace.css`), so a fixed drawer would actually behave **correctly** inside the workspace — *more* correct than at today's `/admin/post-it` (which **is** under `PageTransition`, a transform/filter containing block per the project's known `PageTransition`-captures-`fixed` issue). **Recommendation: portal the drawer to `document.body` via `createPortal` during the extract** — bulletproof regardless of ancestor transforms and consistent with `UnifiedDrawer`.
- **No drag/reorder is proposed** → no Lenis `touchmove` vs pointer conflict, no `data-lenis-prevent` needed. If reordering is added later, scope `data-lenis-prevent` only while dragging.

---

## E. Regression & risk assessment

### Files that would change

**Backend (optional, 1 line):**
- `services/PostItService.java` — `countExpiring()` `LocalDate.now()` → `LocalDate.now(AvailabilityService.BUSINESS_ZONE)` (only if the tab badge relies on this endpoint). No entity/DTO/migration change for the core.

**Frontend (the actual work):**
- `features/admin/WorkspaceSwitch.jsx` — add `{ key: "postit", label: "Post-it" }` to `SEGMENTS`; render the `.wsw__badge` for the `postit` tab.
- `features/admin/AdminWorkspace.jsx` — accept `"postit"` in the view derivation; `lazy()`-import the new panel; extend the mount ternary to 3-way; fetch + own the overdue count; pass count to the switch + a refetch callback to the panel.
- `styles/pages/_workspace.css` — `.wsw` `grid-template-columns: 1fr 1fr 1fr`; `.wsw__pill` `width: calc(33.333% - 4px)`; add `.wsw__badge`; optional `.aw-topbar[data-view="postit"]`.
- **New** `features/admin/postit/PostItPanel.jsx` (+ likely a shared `PostItCard`/content split) — the shell-less board (grid + drawer), reusing the `.pib-` CSS and `postits.api.js`; drawer portaled to `document.body`.
- `pages/admin/PostItBoard.jsx` — either delete-and-replace with a `PostItRedirect` (Navigate → `…/agenda?view=postit`) **or** keep as a thin wrapper around the new panel. (Recommend redirect — see below.)
- `styles/pages/_postit.css` — whiteboard restyle (`.pib-grid` min-width, `.pib-note` flow, `.pib-note-due` chip, "scade il…"/"scaduto" states); remove full-page `min-height`/`dvh` when embedded.
- `components/layout/NavBar.jsx` — repoint the two "Post-it" entries (desktop dropdown + mobile drawer) from `/admin/post-it` to `/profilo/admin/agenda?view=postit`; keep the `nav-postit-badge` (`expiringPostIts`).
- `App.jsx` — convert the `/admin/post-it` route element to a `<Navigate to="/profilo/admin/agenda?view=postit" replace/>` (preserves bookmarks).

### Concrete regression risks & de-risking

| Risk | De-risk |
|---|---|
| 3-segment pill mis-tracks (CSS still `calc(50%)`) | Update `.wsw` grid **and** `.wsw__pill` width together; visually verify all 3 positions + reduced-motion. |
| Extracting `PostItBoard` duplicates page chrome / breaks layout | Split into shell-less `PostItPanel` (no `.pib-page` full-page wrapper, no top padding, no `min-height`); board keeps only grid+drawer. Follow the `ClientsHub` extraction precedent. |
| Drawer `position: fixed` drifts inside workspace | Portal drawer + overlay to `document.body` via `createPortal`. |
| Badge goes stale after in-panel create/toggle/delete | Lift count into `AdminWorkspace`; pass a refetch callback the panel calls post-mutation (or derive from the panel's list and bubble up). |
| NavBar deep-link `?view=postit` not recognized | Add `"postit"` to the `view` derivation in `AdminWorkspace` **in the same pass** as the NavBar repoint; test both entries + a hard reload on the deep-link. |
| Broken bookmarks to `/admin/post-it` | Keep the route as a `<Navigate replace>` redirect (mirrors `ClientiPage → ClientiRedirect`). |
| Shared badge class churn | Don't restyle `.nav-postit-badge`; add a **separate** `.wsw__badge` so NavBar + Notifiche badges are untouched. |
| Timezone drift in badge | If using the backend endpoint, fix `countExpiring()` to `BUSINESS_ZONE`; if FE-derived, no action (browser TZ = Europe/Rome). |

### Single pass vs staged?

**Single pass is safe.** No migration, no schema/DTO change, no positional-record fan-out, no cross-cutting backend edits — the surface is one optional 1-line backend tweak plus a contained frontend refactor that reuses an established in-repo pattern (`ClientiPage → ClientiRedirect`, NavBar repoint). Recommend one branch, e.g. `feat/postit-in-workspace`, in this order: extract panel → wire 3rd view + pill CSS → badge → NavBar redirect → whiteboard restyle → iPad smoke. (Only if an optional §G extra needs a new column does a `V82` migration enter, and that extra should be its own follow-up commit.)

---

## F. Proposed implementation plan (ordered, content-anchored — do NOT implement yet)

1. **(Optional backend, 1 line)** In `PostItService.countExpiring()`, replace `LocalDate.now()` with `LocalDate.now(AvailabilityService.BUSINESS_ZONE)` (import the constant). Skip if the badge is purely FE-derived.
2. **Extract the board into a shell-less panel.** Create `features/admin/postit/PostItPanel.jsx` holding the grid + drawer currently in `PostItBoard.jsx`, reusing `postits.api.js` and the `.pib-` CSS. Split the note card into a `PostItCard` if helpful. **Remove the full-page shell** (`.pib-page` outer padding / `min-height` / `dvh`). **Portal the drawer + overlay to `document.body`** via `createPortal`.
3. **Add the 3rd view.** In `WorkspaceSwitch.jsx`, append `{ key: "postit", label: "Post-it" }` to `SEGMENTS`. In `AdminWorkspace.jsx`, extend the `view` derivation to accept `"postit"`, `lazy()`-import `PostItPanel`, and extend the mount to `view === "agenda" ? <AdminAgendaPage/> : view === "clienti" ? <ClientsHub/> : <PostItPanel .../>`.
4. **Fix the segmented pill for 3.** In `_workspace.css`: `.wsw` → `grid-template-columns: 1fr 1fr 1fr`; `.wsw__pill` → `width: calc(33.333% - 4px)`. Verify `translateX(activeIndex * 100%)` lands on all three; keep the reduced-motion guard.
5. **Overdue badge.** In `AdminWorkspace.jsx`, fetch the count on mount (`fetchExpiringCount()`), store it, pass to `WorkspaceSwitch`; pass a refetch callback to `PostItPanel` invoked after create/toggle/delete. Render `.wsw__badge` (new class, copy `.nav-postit-badge`'s `#c0392b`/`#fff`/`18px`/`700` look) on the `postit` tab when count > 0. Decide+document semantics (`<=today` vs strict overdue).
6. **Redirect the old route + repoint NavBar.** In `App.jsx`, make `/admin/post-it` a `<Navigate to="/profilo/admin/agenda?view=postit" replace/>`. In `NavBar.jsx`, change both "Post-it" entries' targets to `/profilo/admin/agenda?view=postit`; keep the `nav-postit-badge` + `expiringPostIts` fetch.
7. **Whiteboard restyle** in `_postit.css` (`.pib-` prefix only): `.pib-grid` min-width up (~`300–340px`); `.pib-note` flex-column with title+desc lower; `.pib-note-due` promoted to a prominent pill with explicit **"scade il {fmtDate}"** and, when overdue, **"scaduto"** (keep `--overdue`/`--expiring` colors); ensure priority control is ≥44px touch and `stopPropagation`s if made on-card. No `vh`/`dvh`.
8. **Smoke on iPad**: 3-way switch + pill, deep-link `?view=postit` + hard reload, NavBar redirect, drawer open/scroll (portaled), create/toggle/delete → badge updates, overdue vs expiring vs done visuals. Build + lint. Then `--no-ff` merge.

---

## G. Optional extra features (propose, don't build) — ranked by value-for-effort

1. **Priority-as-color accent on the card** — _S, low risk._ The entity already stores **both** `priority` (int) and `color`; derive a card accent/border from `priority` (0→neutral gold, 3→red) so importance reads at a glance on the whiteboard. Pure FE (`.pib-` CSS + existing data). **Best value-for-effort.**
2. **Quick-add-for-today from the agenda** — _S–M, low risk._ A "+ Post-it" affordance in the agenda day header that opens the drawer pre-filled with `dueDate` = the day in view. Reuses `createPostIt`; Chiara/Michela jot a day-anchored reminder without leaving the agenda. Small new UI hook into `AdminAgendaPage`.
3. **Snooze / reschedule chips on the due date** — _S, low risk._ On an overdue card, quick chips ("Domani", "+7g") that bump `dueDate` via the existing `updatePostIt`. Great for touch; no backend change.
4. **Overdue post-its → existing notification bell** — _M, medium risk._ A daily `@Scheduled(zone = "Europe/Rome")` job (precedent: `ClosureReminderScheduler`) emits a notification for newly-overdue post-its, surfacing them in the bell Michela already polls (`fetchUnreadNotifCount`, 30s). Ties into the existing `NotificationType` system; touches notification generation, hence medium risk. **Highest reach, but most moving parts — do it last / separately.**

_Deliberately ranked lower (need a `V82` migration + entity/DTO change → higher risk): pin/hard-order (new `pinned` column), link-post-it-to-customer (`customer_id` FK). Mention to Davide; not for the core pass._

---

**STOP — awaiting go decision.**
