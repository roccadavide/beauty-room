-- FIX-2: aggiunge colonna option_group per raggruppare le opzioni (es. zone corpo laser)
ALTER TABLE service_options
    ADD COLUMN IF NOT EXISTS option_group VARCHAR(80);
