READ ME

	1.	Titolo del progetto

 Beauty Room - Gestionale Estetica

	2.	Descrizione breve

Questo progetto è stato realizzato per la pubblicizzazione del negozio Beauty Room di Michela Rossi, comprende
anche la gestione delle prenotazione e la vendita di prodotti idonei.

        3.	Funzionalità principali

Funzionalità principali
- Registrazione e login utenti con autenticazione JWT
- Ruoli: Customer e Admin
- CRUD prodotti (solo admin)
- CRUD trattamenti (solo admin)
- Carrello prodotti con gestione stock
- Ordini: creazione sia come guest che come utente registrato
- Prenotazioni servizi con gestione disponibilità
- Dashboard utente: visualizza e cancella i propri ordini e prenotazioni
- Responsività completa (Bootstrap 5 + React)

         4.    Tecnologie utilizzate

- Frontend: React, Redux, React-Bootstrap
- Backend: Spring Boot, Spring Security (JWT), JPA/Hibernate
- Database: PostgreSQL
- Stile: Bootstrap 5 + custom CSS

          5.	  Installazione e setup

1) Clona il repository:

git clone https://github.com/roccadavide/CAPSTONE.git
cd CAPSTONE

2) compila file env.properties:

SERVER_PORT=
PG_PASSWORD=
PG_USERNAME=
PG_DB_NAME=

# JWT
JWT_SECRET=

CLOUDINARY_NAME=
CLOUDINARY_KEY=
CLOUDINARY_SECRET=

ADMIN_NAME=
ADMIN_SURNAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_PHONE=


3) Avvia il backend:

Entra nella cartella backend:
cd backend

Assicurati di avere Java 17+ e Maven installati.

Configura le variabili di connessione al database in src/main/resources/application.properties (es. PostgreSQL).

Avvia l’applicazione:
mvn clean install
mvn spring-boot:run

 Il backend sarà disponibile su http://localhost:3001

4) Avvia il frontend:

Entra nella cartella frontend:
cd frontend

Installa le dipendenze:
npm install

Avvia il server di sviluppo:
npm start

Il frontend sarà disponibile su http://localhost:3000


           6.	  Struttura del progetto

CAPSTONE/
│
├── backend/                # Applicazione Spring Boot
│   ├── src/main/java/...   # Codice sorgente Java
│   │   ├── controllers/    # Rest Controller (API REST)
│   │   ├── services/       # Logica di business
│   │   ├── repositories/   # Accesso al database con JPA
│   │   ├── entities/       # Entità JPA (mappatura DB)
│   │   └── security/       # Configurazione Spring Security + JWT
│   ├── src/main/resources/ # Configurazioni (application.properties, schema DB, ecc.)
│   └── pom.xml             # Configurazione Maven e dipendenze
│
├── frontend/               # Applicazione React
│   ├── public/             # File pubblici (index.html, immagini, ecc.)
│   ├── src/                # Codice sorgente React
│   │   ├── api/            # Funzioni per chiamate API
│   │   ├── components/     # Componenti riutilizzabili (Navbar, Footer, ecc.)
│   │   ├── pages/          # Pagine principali (Home, Prodotti, Prenotazioni, Profilo, ecc.)
│   │   ├── redux/          # Stato globale (auth, cart, ecc.)
│   │   └── styles/         # File CSS personalizzati
│   └── package.json        # Dipendenze frontend
│
└── README.md               # Documentazione del progetto


          7.	  Uso del progetto:

	1)	Registrazione / Login
	•	Clicca su Accedi dalla navbar.
	•	Puoi creare un nuovo account o usare le credenziali demo.
	•	Una volta autenticato avrai accesso al profilo, ai tuoi ordini e alle tue prenotazioni.
	2)	Navigazione Prodotti
	•	Vai alla pagina Prodotti.
	•	Puoi filtrare per categoria o cercare tramite barra di ricerca.
	•	Se sei Admin puoi aggiungere, modificare o eliminare i prodotti.
	3)	Gestione Carrello e Ordini
	•	Seleziona un prodotto e aggiungilo al carrello (la quantità non può superare lo stock).
	•	Vai al carrello, conferma l’ordine e scegli se acquistare da guest o come utente loggato.
	•	Gli ordini degli utenti registrati si possono poi visualizzare ed eventualmente eliminare dal profilo.
	4)	Prenotazioni Servizi
	•	Vai su Trattamenti.
	•	Seleziona un trattamento, scegli data e ora disponibili.
	•	Inserisci i tuoi dati e conferma la prenotazione.
	•	Un utente loggato può gestire (visualizzare o cancellare) le proprie prenotazioni.


          8.	  Endpoint principali:

Metodo	URL	Descrizione
POST	/users/register	Registrazione nuovo utente
POST	/noAuth/login	Login utente, ritorna JWT
GET	/products	Recupera lista prodotti
GET	/products/{id}	Recupera dettaglio prodotto
POST	/products	Crea un nuovo prodotto (Admin)
PUT	/products/{id}	Modifica prodotto (Admin)
DELETE	/products/{id}	Elimina prodotto (Admin)
GET	/serviceItems	Recupera lista trattamenti
POST	/bookings	Crea una prenotazione
GET	/bookings/me	Recupera prenotazioni dell’utente loggato
DELETE	/bookings/{id}	Cancella una prenotazione (utente/Admin)
POST	/orders	Crea un ordine (guest o utente loggato)
GET	/orders/me	Recupera ordini dell’utente loggato
DELETE	/orders/{id}	Cancella un ordine (utente/Admin)


     9.	  Credenziali demo:

All’avvio dell’applicazione viene generato un admin con dati presenti nell’env.properties, configurarlo prima.


     10.     Autore/Contatti:

Progetto realizzato da Davide Rocca come Capstone Project per il corso di Full Stack Developer (Epicode).

Email: davide.rocca03@gmail.com
GitHub: https://github.com/roccadavide
