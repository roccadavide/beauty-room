# Beauty Room — Prenotazione & E-commerce

Piattaforma per la gestione delle prenotazioni e la vendita di prodotti del salone Beauty Room di Michela Rossi.

## Stack

| Layer | Tecnologia |
|---|---|
| Backend | Java 21, Spring Boot 3.5.5, Spring Security (JWT), JPA/Hibernate, Flyway |
| Frontend | React 19, Vite, Redux Toolkit, React-Bootstrap |
| Database | PostgreSQL |
| Pagamenti | Stripe Checkout |
| Media | Cloudinary |
| Email | Mailgun |

## Funzionalità principali

- Registrazione e login con JWT (access token + refresh token HttpOnly cookie)
- Ruoli: `CUSTOMER` e `ADMIN`
- CRUD prodotti e trattamenti (solo admin)
- Carrello prodotti con gestione stock
- Checkout prodotti e prenotazioni via Stripe
- Prenotazioni con slot di disponibilità configurabili
- Dashboard admin: report, gestione bookings/ordini, rimborsi
- Dashboard utente: ordini, prenotazioni, profilo

## Setup locale

### Prerequisiti

- Java 21
- Maven 3.9+
- Node.js 20+
- PostgreSQL 15+

### 1. Clona il repository

```bash
git clone https://github.com/roccadavide/CAPSTONE.git
cd CAPSTONE
```

### 2. Configura le variabili d'ambiente

**Backend:**

```bash
cp backend/env.example.properties backend/env.properties
# Modifica backend/env.properties con i tuoi valori
```

**Frontend:**

```bash
cp frontend/.env.example frontend/.env
# Modifica frontend/.env con i tuoi valori
```

### 3. Avvia il backend

```bash
cd backend
./mvnw spring-boot:run
# Il backend sarà disponibile su http://localhost:3001
```

### 4. Avvia il frontend

```bash
cd frontend
npm install
npm run dev
# Il frontend sarà disponibile su http://localhost:5173
```

## Variabili d'ambiente

Tutti i segreti sono gestiti tramite file di ambiente **non committati**.

- Backend: `backend/env.properties` — template in `backend/env.example.properties`
- Frontend: `frontend/.env` — template in `frontend/.env.example`

> Non committare mai `env.properties` o `.env`. Sono già in `.gitignore`.

## Deploy

### Backend — Railway

1. Crea un nuovo progetto Railway e collega il repository.
2. Imposta la **Root Directory** su `backend/`.
3. Railway rileva automaticamente il `Dockerfile` nel backend.
4. Aggiungi un add-on **PostgreSQL** e collega le variabili (`PG_HOST`, `PG_PORT`, ecc.).
5. Configura tutte le variabili d'ambiente da `env.example.properties` nella sezione *Variables*.
6. Imposta `APP_FRONT_URL` e `APP_CORS_ORIGINS` all'URL del frontend su Vercel.

### Frontend — Vercel

1. Importa il repository su Vercel.
2. Imposta la **Root Directory** su `frontend/`.
3. Framework preset: **Vite**.
4. Aggiungi le variabili d'ambiente da `.env.example` nella sezione *Environment Variables*.
5. Imposta `VITE_API_BASE_URL` all'URL del backend su Railway.
6. Il file `vercel.json` gestisce il fallback SPA per React Router.

## Struttura del progetto

```
beauty-room/
├── backend/                  # Spring Boot
│   ├── src/main/java/        # Sorgenti Java
│   │   ├── controllers/      # REST controllers
│   │   ├── services/         # Business logic
│   │   ├── repositories/     # JPA repositories
│   │   ├── entities/         # Entità JPA
│   │   ├── security/         # JWT + Spring Security
│   │   └── email/            # Outbox email (Mailgun)
│   ├── src/main/resources/
│   │   ├── application.properties
│   │   └── db/migration/     # Script Flyway
│   ├── Dockerfile
│   └── pom.xml
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── api/              # Moduli API (axios)
│   │   ├── components/       # Componenti riutilizzabili
│   │   ├── features/         # Slice Redux + pagine per dominio
│   │   └── styles/           # CSS modulare
│   ├── vercel.json
│   └── package.json
│
└── README.md
```

## Endpoint principali

| Metodo | URL | Descrizione |
|--------|-----|-------------|
| POST | `/auth/register` | Registrazione |
| POST | `/auth/login` | Login (ritorna JWT) |
| GET | `/products` | Lista prodotti |
| GET | `/service-items` | Lista trattamenti |
| POST | `/checkout/create-session` | Checkout prodotti (auth) |
| POST | `/checkout/create-session-guest` | Checkout prodotti (guest) |
| POST | `/checkout/bookings/create-session` | Checkout prenotazione (auth) |
| POST | `/checkout/bookings/create-session-guest` | Checkout prenotazione (guest) |
| POST | `/stripe/webhook` | Webhook Stripe |
| GET | `/admin/**` | Endpoints admin (ruolo ADMIN) |

## Autore

Progetto realizzato da **Davide Rocca** come Capstone Project per il corso Full Stack Developer (Epicode).

- Email: davide.rocca03@gmail.com
- GitHub: https://github.com/roccadavide
