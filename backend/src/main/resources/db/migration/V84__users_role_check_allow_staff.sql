-- Estende il CHECK constraint users_role_check per includere il ruolo STAFF.
-- Il constraint originale (V1__baseline) ammetteva solo CUSTOMER e ADMIN; il
-- prompt 02 multi-staff ha esteso l'enum Java Role con STAFF ma nessuna migration
-- aveva aggiornato il vincolo DB, quindi l'INSERT di uno staff falliva a runtime
-- su Postgres con: new row for relation "users" violates check constraint
-- "users_role_check". H2 (test) non esegue Flyway e non lo intercettava.
--
-- Guardato e idempotente: DROP ... IF EXISTS + ADD ricreano il vincolo.
--
-- Rollback: ripristinare la definizione precedente (V1__baseline):
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
--   ALTER TABLE users
--     ADD CONSTRAINT users_role_check
--     CHECK (((role)::text = ANY ((ARRAY['CUSTOMER'::character varying, 'ADMIN'::character varying])::text[])));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (((role)::text = ANY ((ARRAY['CUSTOMER'::character varying, 'ADMIN'::character varying, 'STAFF'::character varying])::text[])));
