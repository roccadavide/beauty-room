ALTER TABLE services ADD COLUMN display_order INTEGER;
ALTER TABLE products ADD COLUMN display_order INTEGER;

UPDATE services s
SET display_order = sub.rn
FROM (
    SELECT service_id, (ROW_NUMBER() OVER (ORDER BY title ASC) - 1) AS rn
    FROM services
) sub
WHERE s.service_id = sub.service_id;

UPDATE products p
SET display_order = sub.rn
FROM (
    SELECT product_id, (ROW_NUMBER() OVER (ORDER BY name ASC) - 1) AS rn
    FROM products
) sub
WHERE p.product_id = sub.product_id;

ALTER TABLE services ALTER COLUMN display_order SET DEFAULT 0;
ALTER TABLE services ALTER COLUMN display_order SET NOT NULL;
ALTER TABLE products ALTER COLUMN display_order SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN display_order SET NOT NULL;
