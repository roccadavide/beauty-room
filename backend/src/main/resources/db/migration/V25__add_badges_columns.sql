-- Aggiunge il campo badges (JSON array string) a services, products, service_options, promotions.
-- Gestito come VARCHAR(500) in Java; serializzazione/deserializzazione manuale.

ALTER TABLE services       ADD COLUMN IF NOT EXISTS badges VARCHAR(500);
ALTER TABLE products       ADD COLUMN IF NOT EXISTS badges VARCHAR(500);
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS badges VARCHAR(500);
ALTER TABLE promotions     ADD COLUMN IF NOT EXISTS badges VARCHAR(500);
