-- Aggiunge durata in minuti per singola opzione (nullable per retrocompatibilità)
ALTER TABLE service_options
    ADD COLUMN IF NOT EXISTS duration_min INTEGER;
