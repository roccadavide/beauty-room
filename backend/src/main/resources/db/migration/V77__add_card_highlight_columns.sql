-- V77: per-card "Electric Border" highlight (services + products only). Additive only.
-- highlight_enabled defaults FALSE so existing rows are untouched (not highlighted).
-- highlight_color is nullable; the application layer supplies the default colour when enabled.
ALTER TABLE services ADD COLUMN highlight_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE services ADD COLUMN highlight_color   VARCHAR(9);

ALTER TABLE products ADD COLUMN highlight_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN highlight_color   VARCHAR(9);
