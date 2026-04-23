-- V33: tabella impostazioni applicazione (singleton row, key=value)
CREATE TABLE IF NOT EXISTS app_settings (
    key   VARCHAR(100) PRIMARY KEY,
    value TEXT         NOT NULL
);

-- Valore di default: politica cancellazione 24 ore
INSERT INTO app_settings (key, value)
VALUES ('cancellation_hours_limit', '24')
ON CONFLICT (key) DO NOTHING;
