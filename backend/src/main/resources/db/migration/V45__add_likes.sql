-- Tabella likes per rate limiting e storico
CREATE TABLE likes (
    id          BIGSERIAL    PRIMARY KEY,
    entity_type VARCHAR(20)  NOT NULL,
    entity_id   UUID         NOT NULL,
    ip_hash     VARCHAR(64)  NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_likes_entity ON likes (entity_type, entity_id);
CREATE INDEX idx_likes_rate_limit ON likes (entity_type, entity_id, ip_hash, created_at);

-- Counter denormalizzato sulle entità
ALTER TABLE services ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE results  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
