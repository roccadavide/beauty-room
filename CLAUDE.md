# Beauty Room — Claude Code Brief

## Progetto

Sito web e gestione per Beauty Room, il centro estetico di Michela (Calusco d'Adda, BG).
Stack: React (frontend) + Spring Boot Java (backend) + PostgreSQL su Railway.
Dev: Davide — developer full stack, preferisce risposte dirette senza fronzoli.

## Target clientela del business

- Donne e uomini di tutte le età (dai 15 anni in su)
- SEO target locale: "estetista Calusco d'Adda", "centro estetico Calusco d'Adda", "ceretta Calusco", ecc.
- Nota: per la clientela maschile si escludono trattamenti intimi (ceretta inguine/zona bikini)

## Comandi principali

```bash
# Frontend (aggiorna se i comandi sono diversi)
cd frontend && npm run dev          # avvia dev server
cd frontend && npm run build        # build produzione
cd frontend && npm test             # test

# Backend
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev,local   # avvia Spring Boot (local = DevTools trigger-file)
cd backend && ./mvnw test              # test
cd backend && ./mvnw package           # build JAR
```

## Struttura del progetto

```
beauty-room/
├── frontend/          # React app
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── assets/
├── backend/           # Spring Boot
│   ├── src/main/java/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── models/
└── CLAUDE.md
```

## Convenzioni di codice

### Frontend (React)

- Componenti: PascalCase (`ServiceCard.jsx`)
- Hook custom: `use` prefix (`useScrollRestore.js`)
- CSS: moduli CSS o classi Bootstrap, no inline styles tranne eccezioni documentate
- Smooth scroll: Lenis attivo globalmente — non usare `window.scrollTo` o `document.scrollTop` direttamente
- Animazioni: Framer Motion — usare `useInView` per trigger scroll, non avvolgere col Bootstrap direttamente in motion.div (usare div interno)
- Layout: Bootstrap grid — rispettare il sistema gutter

### Backend (Java/Spring Boot)

- Controller → Service → Repository (mai saltare livelli)
- Endpoint REST: `/api/v1/resource` in kebab-case
- Risposte: sempre wrappare in ResponseEntity
- Validazione: Bean Validation (@Valid, @NotNull, ecc.)
- Eccezioni: GlobalExceptionHandler centralizzato
- DTO separati dai Model per le risposte API

### Database (PostgreSQL su Railway)

- Migrazioni: Flyway — mai modificare tabelle direttamente
- Nomi tabelle: snake_case plurale (`beauty_services`, `booking_slots`)
- Indici obbligatori su colonne usate in WHERE, JOIN, ORDER BY frequenti
- Relazioni con FK e CASCADE appropriato
- Mai query N+1 — usare JOIN o fetch appropriato (JPA: LAZY default, EAGER solo se giustificato)

## Decisioni architetturali prese (non cambiare senza conferma)

- **Smooth scroll**: Lenis — gestisce tutto lo scroll del sito
- **Animazioni**: Framer Motion — entry animations on scroll con useInView
- **Grid**: Bootstrap — sistema gutter intatto, no sostituzioni con CSS grid custom
- **ServiceDetail — immagine fissa**: `position: fixed` sulla colonna immagine, non sticky. Sticky non funzionava perché il contenuto della colonna destra influenzava lo scroll della sinistra. Fixed risolve il comportamento voluto.
- **Scroll restoration su listing**: sessionStorage + data-scroll-id su elementi via useRef. Questa è la soluzione definitiva — non tornare a scrollTo pixel-based.
- **Bootstrap + Framer Motion**: mai wrappare un col Bootstrap in motion.div direttamente — usare sempre un div wrapper interno

## Regole comportamentali (SEMPRE)

- Prima di proporre un fix, spiega la root cause
- Non modificare file fuori dallo scope della richiesta
- Se modifichi il backend, verifica che il frontend non si rompa e viceversa
- Commit atomici: una feature o fix per commit
- Prima di aggiungere una dipendenza npm o Maven, chiedi conferma esplicita
- Non rimuovere mai funzionalità esistenti senza conferma
- Dammi un piano breve prima di iniziare task grossi (più di 2 file coinvolti)

## Regole comportamentali (MAI)

- Non usare `window.scrollTo` o `document.scrollTop` direttamente — passa sempre per Lenis
- Non aggiungere `console.log` in commit definitivi
- Non hard-codare URL del backend — usare variabili d'ambiente
- Non committare segreti, credenziali o file `.env`
- Non pushare su `main` senza review
- Non usare `git push --force`

## Git workflow

- Branch: `feature/nome-feature` o `fix/nome-bug`
- Commit: conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `style:`, `docs:`)
- Worktrees in `.claude/worktrees/` — gitignored
- Prima di committare: `git diff --staged` per review, poi `git commit -m "tipo: descrizione"`
- Non pushare su main direttamente — crea branch, poi PR

## Variabili d'ambiente

Frontend: `VITE_API_BASE_URL`, `VITE_ENV`
Backend: `DATABASE_URL` (Railway), `JWT_SECRET`, `SPRING_PROFILES_ACTIVE`
