-- Campo active per cataloghi (services, products, results).
-- promotions ha già la colonna active; packages/package_credits non si toccano.

ALTER TABLE services ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE results ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
