# AUDIT PRE-GO-LIVE — Beauty Room
> Generato il 2026-03-17 | Senior Fullstack Review
> Stack: React 19 + Vite + Bootstrap 5 · Spring Boot 3.5.5 + Java 21 + PostgreSQL + Flyway + Spring Security JWT · Stripe

---

## 1. BACKEND — Logica prenotazioni e pagamenti

### Flusso prenotazione (analisi completa)
Il flusso è implementato correttamente e robusto:
1. `POST /checkout/bookings/create-session[-guest]` → crea **Hold Booking** (`PENDING_PAYMENT`) con `expiresAt = now + 12min`
2. Lock pessimistico (`@Lock(PESSIMISTIC_WRITE)`) su `lockOverlappingBookingsByStatuses` prima di creare il record
3. Stripe Checkout Session creata e `stripeSessionId` salvato sul booking
4. Webhook `checkout.session.completed` → `confirmPaidBookingFromWebhook` → status = `CONFIRMED`
5. `BookingHoldScheduler` gira ogni 60 secondi ed espira i PENDING_PAYMENT scaduti

---

🔴 **CRITICO — Nessuna API di rimborso Stripe implementata**
Quando un admin vuole cancellare una prenotazione pagata online, il sistema lancia:
`"Questa prenotazione è stata pagata online. Gestisci prima il rimborso prima di eliminarla."`
ma non esiste **nessuna chiamata a `Stripe Refund API`** in tutto il codebase (nessun `RefundCreateParams`).
Il rimborso deve essere fatto manualmente dalla dashboard Stripe. Per go-live su clienti paganti, questo è bloccante: un admin inesperto non saprà come emettere il rimborso e il cliente si ritroverà addebitato senza ricevere il servizio.
→ **File**: `BookingService.java:589`, `BookingCheckoutController.java`
→ **Fix**: implementare endpoint `POST /admin/bookings/{id}/refund` che chiami `Refund.create()` con il `payment_intent` recuperato dalla Stripe Session.

---

🔴 **CRITICO — `serviceOptionId` hardcoded a `null` nel flusso pubblico**
Il `BookingModal` pubblico invia sempre `serviceOptionId: null`:
```js
// BookingModal.jsx:229
serviceOptionId: null, // per ora (quando aggiungi opzioni lo colleghi)
```
I servizi con pacchetti multi-seduta (es. 5 sessioni laser) esistono nel backend e nel pannello admin, ma il cliente **non può mai selezionarli online** né pagare il prezzo corretto del pacchetto. Il prezzo di default del servizio base viene sempre usato.
→ **Fix**: aggiungere il select delle opzioni al BookingModal (step 1 o nuovo step tra data e orario).

---

🟡 **IMPORTANTE — `payment_intent.payment_failed` non gestisce i booking**
Nel `StripeWebhookController.handlePaymentFailed()` (riga 277), viene processato solo il fallimento degli ordini (`orderId` nei metadata). Per i booking, il fallimento è gestito solo da `checkout.session.expired`. Se un pagamento fallisce per problemi di rete senza che la sessione scada, il booking resta `PENDING_PAYMENT` fino allo scheduler (max 12 min). Non è un blocco immediato ma va monitorato.
→ **File**: `StripeWebhookController.java:268-286`

---

🟡 **IMPORTANTE — PAID_CONFLICT: rimborso manuale senza notifica al cliente**
Quando un booking scade ma arriva comunque il pagamento Stripe dopo la scadenza E lo slot è già occupato (`PAID_CONFLICT`), il sistema:
1. Cancella il booking ✅
2. Invia alert all'admin via email ✅
3. **NON invia nessuna comunicazione al cliente** e **NON rimborsa automaticamente**
→ Il cliente paga, non riceve niente, e non viene avvisato. Richiede intervento manuale urgente.
→ **File**: `StripeWebhookController.java:139-156`
→ **Fix**: aggiungere email al cliente nel `enqueuePaidConflictAlert` + automatizzare rimborso.

---

🟡 **IMPORTANTE — Idempotenza prenotazione doppio click**
Se il cliente clicca due volte "Prenota" prima del redirect Stripe, vengono create **due Hold Booking** sullo stesso slot. Il secondo fallisce con `BadRequestException("Esiste già una prenotazione in questo intervallo.")` (il lock pessimistico protegge l'indice unico), ma la risposta HTTP 400 viene esposta al frontend.
Il frontend gestisce l'errore (`catch(err) → setError`) ma non previene il doppio click con un flag `isLoading`.
→ **File**: `BookingModal.jsx:209-241`, `BookingService.java:110`
→ **Fix**: disabilitare il bottone Conferma durante la chiamata API.

---

🟡 **IMPORTANTE — Cancellazione booking: regola 24h non comunicata al cliente**
La regola esiste server-side (`BookingService.java:581`): il cliente non può cancellare entro 24h. Il frontend (`MyBookings`) mostra il bottone cancella senza indicare questa restrizione. Il cliente tenta, riceve l'errore 400, ma non sa perché.

---

🟢 **MIGLIORAMENTO — Codice duplicato in `updateBookingStatus`**
Il blocco `CANCELLED` è scritto due volte consecutive:
```java
// BookingService.java:530-534 (primo blocco)
if (newStatus == BookingStatus.CANCELLED) { ... }
// BookingService.java:540-544 (secondo blocco identico)
if (newStatus == BookingStatus.CANCELLED) { ... }
```

---

🟢 **MIGLIORAMENTO — Scheduler BookingHold non thread-safe in cluster**
`BookingHoldScheduler` usa `fixedDelay = 60_000`. In un'architettura multi-istanza (es. 2 pod Railway) entrambe le istanze eseguono lo scheduler contemporaneamente. Nessun locking distribuito. Non blocca il go-live su istanza singola ma da tenere a mente.

---

## 2. BACKEND — Sicurezza

🟡 **IMPORTANTE — Endpoint pubblici: `/checkout/bookings/booking-summary` espone dati del cliente**
`GET /checkout/bookings/booking-summary?session_id=...` è pubblico (riga 95 `SecConfig`). Chiunque con un `session_id` Stripe valido può leggere nome, email e telefono del cliente.
I session ID Stripe hanno formato prevedibile (`cs_test_...` / `cs_live_...`) e sono inclusi nell'URL del browser. Non è trivialmente bruteforce-abile, ma è un information leak non necessario.
→ **Fix**: rendere l'endpoint accessibile solo a utenti autenticati, oppure validare che il `session_id` corrisponda al booking dell'utente corrente.

---

🟡 **IMPORTANTE — `X-Forwarded-For` spoofable nel rate limiter**
`RateLimitFilter.java:84-92`: l'IP viene letto dall'header `X-Forwarded-For` senza validare che il proxy sia trusted. Un attaccante può bypassare il rate limit su login con:
```
X-Forwarded-For: 1.2.3.4  (IP diverso ogni richiesta)
```
→ **File**: `RateLimitFilter.java:83-101`
→ **Fix**: configurare Spring's `server.forward-headers-strategy=native` (già fatto in prod!) e leggere solo il `RemoteAddr` dopo il trust del proxy, oppure aggiungere una whitelist di proxy trusted.

---

🟡 **IMPORTANTE — Rate limiting assente su `/checkout/bookings/create-session-guest`**
Il rate limit copre solo `POST /auth/login` e `POST /auth/register`. L'endpoint di creazione checkout guest è pubblico e non limitato. Un bot può creare centinaia di booking PENDING_PAYMENT bloccando tutti gli slot disponibili per 12 minuti.
→ **File**: `RateLimitFilter.java:47-52`
→ **Fix**: aggiungere bucket rate limit sul path `/checkout/bookings/`.

---

🟢 **SICUREZZA POSITIVA — Tutto il resto è ben implementato**
- JWT access: 15 min ✅, refresh: 14 giorni ✅
- Refresh token in HttpOnly cookie ✅
- BCrypt strength 12 ✅
- HSTS in produzione ✅
- CORS da env var, non wildcard ✅
- `@PreAuthorize` su tutti gli endpoint admin ✅
- GlobalExceptionHandler non espone stack trace ✅
- `spring.jpa.show-sql=false` in prod ✅
- Flyway `validate-on-migrate=true` ✅
- CSRF disabilitato correttamente (stateless JWT) ✅

---

## 3. BACKEND — Qualità codice e struttura

🟡 **IMPORTANTE — `Stripe.apiKey` assegnato a ogni richiesta (non ottimale)**
Sia `PaymentController` che `BookingCheckoutController` fanno `Stripe.apiKey = stripeSecretKey` ad ogni chiamata di metodo. Questo è un approccio thread-unsafe in teoria (variabile statica globale), sebbene in pratica con una singola chiave non crei problemi. La best practice è configurare la chiave a startup tramite `@PostConstruct`.
→ **File**: `BookingCheckoutController.java:53`, `PaymentController.java`

---

🟡 **IMPORTANTE — Flyway: V4 e V6 creano lo stesso indice**
```sql
-- V4__add_booking_slot_unique_index.sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_slot ON bookings(start_time, end_time) WHERE booking_status IN (...)
-- V6__fix_booking_slot_unique_index.sql  (identico)
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_slot ON bookings(start_time, end_time) WHERE booking_status IN (...)
```
V4 aveva probabilmente un bug, V6 lo ricrea. Con `IF NOT EXISTS` non è un blocco, ma rende il migration history confuso. Le migration **esistenti non vanno mai modificate** (✅ rispettato), ma V6 dovrebbe idealmente essere un `DROP INDEX + CREATE` esplicito o una correzione diversa.

---

🟢 **MIGLIORAMENTO — `BookingResponseDTO` non include il nome del servizio**
`BookingResponseDTO.java:19` include solo `serviceId (UUID)` e non `serviceTitle (String)`. Questo causa il bug nell'UI (vedi sezione Frontend §4). Sarebbe utile aggiungere `serviceTitle` al DTO.

---

🟢 **MIGLIORAMENTO — `AdminBookingController` vs `BookingController`: logica admin duplicata**
Esistono due controller separati per admin e utente. La logica di autorizzazione è in parte nel controller (`@PreAuthorize`) e in parte nel service (`isAdmin(currentUser)`). Stile non uniforme ma funzionante.

---

🟢 **MIGLIORAMENTO — Nessun test E2E sul flusso Stripe**
Esistono test unitari (`BookingServiceTest`, `AuthIntegrationTest`) ma nessun test che mocki il webhook Stripe end-to-end.

---

## 4. FRONTEND — Funzionalità critiche

🔴 **CRITICO — `BookingSuccessPage` mostra UUID invece del nome servizio**
```jsx
// BookingSuccessPage.jsx:125-129
{data.booking.serviceId && (
  <div className="bs-row">
    <span>Servizio</span>
    <strong>{data.booking.serviceId}</strong>  {/* ← UUID grezzo! */}
  </div>
)}
```
Il cliente nella pagina di conferma vede un UUID come `268a5ef7-82ec-470f-...` al posto di "Pelo Pelo". Esperienza pessima.
→ **Fix (breve termine)**: aggiungere `serviceTitle` al `BookingResponseDTO` e usarlo nel frontend. **Fix alternativo**: fetch del servizio con l'ID nella `BookingSuccessPage`.

---

🟡 **IMPORTANTE — BookingModal: doppio click possibile su "Conferma e Paga"**
Il bottone `confirm` non ha stato di loading/disabled. Un utente veloce può triggerare due checkout Stripe simultanei.
→ **File**: `BookingModal.jsx:209`, step 4
→ **Fix**: aggiungere `const [paying, setPaying] = useState(false)` e `disabled={paying}` sul bottone.

---

🟡 **IMPORTANTE — Chiusura modal dopo il redirect Stripe: slot non rilasciato**
Se il cliente va su Stripe e chiude il tab senza pagare, il booking PENDING_PAYMENT rimane fino allo scheduler (max 12 min). Non è un bug ma un comportamento atteso — **tuttavia** il cliente che riprova entro 12 min riceve l'errore "slot già occupato" senza spiegazione. Il frontend mostra il messaggio di errore generico del backend.
→ **Fix UX**: se l'errore dal backend contiene "prenotazione in questo intervallo", mostrare un messaggio specifico: "Hai già una prenotazione in attesa per questo slot. Attendi qualche minuto e riprova."

---

🟡 **IMPORTANTE — `isDesktop` calcolato una sola volta al render, non reattivo al resize**
```jsx
// BookingModal.jsx:259
const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
```
Se l'utente ruota il dispositivo o ridimensiona la finestra mentre il modal è aperto, il panel non cambia tra `bm-panel--side` e `bm-panel--sheet`. Non è bloccante ma può causare layout rotto.
→ **Fix**: sostituire con `useWindowSize()` hook o `window.matchMedia`.

---

🟢 **MIGLIORAMENTO — Gestione errore API migliorabile**
Le chiamate API in alcuni componenti (`AllBookings.jsx:46`, `MyBookings.jsx:44`) loggano solo `console.error` senza mostrare all'utente un messaggio visibile. L'utente vede la lista vuota senza capire il motivo.

---

## 5. FRONTEND — Coerenza design e UX

🟡 **IMPORTANTE — CSS duplicato: eyebrow/title pattern ridefinito più volte**
In `_services-preview.css`, le classi `.sp-eyebrow`, `.sp-title`, `.sp-subtitle` sono definite con stili identici a `.section-eyebrow`, `.section-title`, `.section-subtitle` nello stesso file (righe 24-51 vs 53-79). Stessa situazione in `_testimonial-section.css`. Aumenta il peso del CSS e rende il mantenimento difficile.

---

🟡 **IMPORTANTE — Overflow-x ancora potenzialmente presente**
Nonostante il fix con `#root { overflow-x: clip }`:
- `.sp-arrow--prev { left: -16px }` e `.sp-arrow--next { right: -16px }` in `_services-preview.css:223-228` possono ancora uscire dai bordi su viewport molto stretti.
- `.rc-arrow--left { left: -6px }` / `rc-arrow--right { right: -6px }` in `_services-preview.css:358-363`.
Entrambi sono dentro sezioni con `overflow: hidden` o dentro il clip di `#root`, quindi non dovrebbero causare scrollbar visibili, ma vanno verificati su dispositivi reali.

---

🟢 **MIGLIORAMENTO — `console.debug` presente in produzione**
```js
// CartPage.jsx:35
console.debug("[checkout] endpoint: /checkout/create-session (auth)", {...})
// LaserFlow.jsx:413
console.debug("[LaserFlow] shader OK — canvas %d×%d", w, h)
```
Vanno rimossi o sostituiti con un logger condizionale (`import.meta.env.DEV`).

---

🟢 **MIGLIORAMENTO — Accessibilità base: buona ma migliorabile**
- Tutte le immagini hanno `alt` ✅
- Bottoni principali hanno `aria-label` ✅
- `BookingModal` ha `role="dialog"` e `aria-modal="true"` ✅
- I bottoni `.bc-day` nel calendario non hanno `type="button"` (alcuni sì, ma i click handler sono su `div`) — rischio di submit form accidentale.
- Assenza di `aria-live` sulla sezione errori del BookingModal: gli screen reader non annunciano i messaggi di errore.

---

🟢 **MIGLIORAMENTO — `BookingModal` (pubblico) e `BookingModal` (admin) sono due file separati**
`/features/bookings/BookingModal.jsx` e `/components/admin/BookingModal.jsx` co-esistono. La logica di calendario e slot è duplicata. Post go-live, unificarli in un componente parametrizzato ridurrebbe la manutenzione.

---

## 6. FRONTEND — Qualità codice

🟡 **IMPORTANTE — `.env` di default usa la chiave Stripe di test**
```env
# frontend/.env
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
Il file `.env.production` ha `pk_live_...` come placeholder ma **non ha la chiave reale**. Se il deploy usa `.env` e non `.env.production`, Stripe sarà in modalità test in produzione.
→ **Fix prima del go-live**: impostare la chiave pubblica live come variabile d'ambiente nella piattaforma di deploy.

---

🟡 **IMPORTANTE — Nessun `.env.example` per il frontend**
Non esiste un file `.env.example` che documenti le variabili richieste. Un nuovo sviluppatore non sa che servono `VITE_API_BASE_URL` e `VITE_STRIPE_PUBLIC_KEY`.
→ **Fix**: creare `frontend/.env.example` con tutte le variabili e valori placeholder.

---

🟢 **MIGLIORAMENTO — `console.log` / `console.error` in componenti di produzione**
```js
// Login.jsx:68 — console.error(err)
// Register.jsx:57 — console.error(err)
// CheckoutModal.jsx:87 — console.error("Errore pagamento:", err)
```
I `console.error` su oggetti di errore potrebbero esporre informazioni sensibili (stack trace, response body) nelle DevTools di utenti malevoli.
→ **Fix**: logare solo `err.message` o usare un logger condizionale su `import.meta.env.DEV`.

---

🟢 **MIGLIORAMENTO — Import inutilizzati sparsi**
`Layout.jsx` importa `Navbar` da Bootstrap ma usa `<Navbar />` (non definito nel file) — il componente non è usato nel routing principale (viene usato direttamente `NavBar` in `App.jsx`).

---

🟢 **MIGLIORAMENTO — CSS `related-carousel` in `_services-details-page.css` non più usato**
Il componente `RelatedCarousel` usa classi `rc-wrapper`/`rc-track` definite in `_services-preview.css`. Le classi `.related-carousel`, `.related-carousel .related-card` in `_services-details-page.css:51-92` sono CSS zombie (non ci sono elementi con quella classe nel DOM corrente).

---

## 7. DEPLOY READINESS

🔴 **CRITICO — Nessuna configurazione Stripe live webhook**
Per la produzione serve registrare l'URL `https://[dominio]/stripe/webhook` nella dashboard Stripe e ottenere un nuovo `STRIPE_WEBHOOK_SECRET` live. Se si usa lo stesso secret di test, i webhook Stripe in produzione verranno rifiutati con 400 (firma non valida).

---

🔴 **CRITICO — Chiave Stripe test nel frontend**
Come da §6: `VITE_STRIPE_PUBLIC_KEY=pk_test_xxx` in `.env`. Va sostituita con la chiave pubblica live prima del deploy.

---

🟡 **IMPORTANTE — README obsoleto**
`README.md` nella root descrive il progetto come Capstone (non produzione), riferisce endpoint inesistenti (`/noAuth/login`), menziona Java 17 invece di 21, dice `npm start` invece di `npm run dev`, non menziona Stripe, Mailgun, Lenis, le funzionalità di agenda admin o i package credits. Per un progetto in go-live dovrebbe essere aggiornato.

---

🟡 **IMPORTANTE — `app.brand.logoUrl` punta a localhost nelle email**
```properties
# application.properties:66
app.brand.logoUrl=${APP_BRAND_LOGO_URL:http://localhost:5173/logo-email.png}
```
Il default fallback è `localhost`. Se `APP_BRAND_LOGO_URL` non è impostata in produzione, tutte le email di conferma avranno il logo rotto.
→ **Fix**: impostare `APP_BRAND_LOGO_URL` nell'env di produzione.

---

🟡 **IMPORTANTE — Nessun Dockerfile né `docker-compose.yml`**
Non esiste containerizzazione. Il deploy su Railway/Render può funzionare anche senza Docker (buildpack), ma la mancanza di Dockerfile rende il setup non riproducibile e potenzialmente problematico se la piattaforma di deploy non supporta buildpack Spring Boot automaticamente.

---

🟡 **IMPORTANTE — `vite.config.js` minimale, nessun `base` configurato**
```js
export default defineConfig({ plugins: [react()] })
```
Se il frontend viene deployato su un sub-path (es. `/app`), il routing React non funzionerà. Inoltre manca la configurazione del server di produzione (nginx/caddy) per gestire il fallback su `index.html` per il client-side routing. Se non configurato correttamente, tutti i deep link (es. `/trattamenti/uuid`) daranno 404 al refresh.
→ **Fix**: assicurarsi che il server web abbia `try_files $uri /index.html` (nginx) o equivalente.

---

🟡 **IMPORTANTE — `env.properties` nel backend: non documentata completamente**
Il `README.md` documenta solo le variabili base (PG, JWT, Cloudinary, Admin). Mancano completamente:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAIL_FROM`
- `APP_CORS_ORIGINS`, `APP_FRONT_URL`, `APP_BRAND_LOGO_URL`
- `JWT_COOKIE_SECURE`, `JWT_COOKIE_SAMESITE`, `JWT_COOKIE_DOMAIN`
→ **Fix**: aggiornare README o creare `backend/env.example.properties`.

---

🟢 **DEPLOY POSITIVO — Sicurezza production profile ben configurata**
- `ddl-auto=none` ✅
- `show-sql=false` ✅
- HSTS abilitato ✅
- Cookie `Secure=true` ✅
- CORS da `CORS_ORIGINS_PROD` ✅
- `server.forward-headers-strategy=native` ✅
- Tutti i segreti da env var, nessun valore hardcoded critico ✅

---

## ⚡ PRIORITÀ — Lista ordinata pre go-live

### 🔴 BLOCCANTI (risolvere prima di andare live)

| # | Problema | File/Posizione |
|---|----------|----------------|
| 1 | **Stripe refund non automatizzato**: l'admin non può rimborsare dall'app | `BookingService.java:589`, da implementare |
| 2 | **`serviceOptionId: null`** nel booking pubblico: pacchetti non prenotabili online | `BookingModal.jsx:229` |
| 3 | **BookingSuccessPage mostra UUID** invece del nome servizio | `BookingSuccessPage.jsx:128` |
| 4 | **Chiave Stripe test** nel frontend | `frontend/.env` → impostare `pk_live_...` |
| 5 | **Webhook Stripe produzione** non configurato: registrare endpoint su Stripe dashboard | Dashboard Stripe + env `STRIPE_WEBHOOK_SECRET` live |

### 🟡 IMPORTANTI (fare prima possibile, idealmente prima del lancio)

| # | Problema | File/Posizione |
|---|----------|----------------|
| 6 | **PAID_CONFLICT**: cliente pagante non avvisato e non rimborsato automaticamente | `StripeWebhookController.java:139-156` |
| 7 | **Rate limit assente** su `/checkout/bookings/create-session-guest` (slot bombing) | `RateLimitFilter.java:47-52` |
| 8 | **`booking-summary` pubblico** espone dati personali del cliente | `SecConfig.java:95` |
| 9 | **Doppio click "Conferma e Paga"**: no stato `paying` / bottone non disabilitato | `BookingModal.jsx:209` |
| 10 | **`X-Forwarded-For` spoofable** nel rate limiter | `RateLimitFilter.java:83` |
| 11 | **`app.brand.logoUrl` fallback localhost** nelle email | `application.properties:66` |
| 12 | **README obsoleto**: documenta endpoint vecchi, variabili env mancanti | `README.md` |
| 13 | **Nessun `.env.example`** per il frontend | Da creare |
| 14 | **Nessun Dockerfile** | Da creare |
| 15 | **Server web production**: configurare fallback su `index.html` per SPA routing | Nginx/Caddy/hosting config |

### 🟢 POST GO-LIVE (nice to have)

| # | Problema |
|---|----------|
| 16 | Rimuovere `console.debug` e `console.error` con oggetti raw in produzione |
| 17 | Unificare `BookingModal` pubblico e admin in un componente condiviso |
| 18 | Aggiungere `serviceTitle` al `BookingResponseDTO` |
| 19 | Eliminare CSS zombie `.related-carousel` in `_services-details-page.css` |
| 20 | Deduplicare `.sp-eyebrow`/`.section-eyebrow` e simili nel CSS |
| 21 | Aggiungere `aria-live` sulle zone errore del BookingModal |
| 22 | Fix `isDesktop` non reattivo al resize nel BookingModal |
| 23 | Risolvere codice duplicato `CANCELLED` in `updateBookingStatus` (righe 530-534 e 540-544) |
| 24 | Configurare `Stripe.apiKey` a startup (`@PostConstruct`) invece di ogni richiesta |
| 25 | Aggiungere scheduler distribuito (ShedLock) se si scala a più istanze |
