CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash      VARCHAR(128) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    expires_at      TIMESTAMP NOT NULL,
    revoked_at      TIMESTAMP,
    replaced_by_hash VARCHAR(128),
    parent_hash     VARCHAR(128),
    user_agent      TEXT,
    ip              TEXT
);

CREATE UNIQUE INDEX uq_refresh_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_parent ON refresh_tokens (parent_hash);
