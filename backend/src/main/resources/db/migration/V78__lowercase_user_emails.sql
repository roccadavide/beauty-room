-- V78: make User-login emails case-insensitive.
-- 1) Abort loudly if two rows differ only by case (would violate uniqueness after lowercasing).
-- 2) Lowercase + trim existing emails.
-- 3) Replace the case-sensitive UNIQUE constraint with a functional case-insensitive unique index.

DO $$
DECLARE
    dup_count integer;
BEGIN
    SELECT count(*) INTO dup_count
    FROM (
        SELECT lower(btrim(email)) AS norm
        FROM users
        GROUP BY lower(btrim(email))
        HAVING count(*) > 1
    ) d;

    IF dup_count > 0 THEN
        RAISE EXCEPTION 'V78 aborted: % case-insensitive duplicate email group(s) in users. Merge them before migrating.', dup_count;
    END IF;
END $$;

UPDATE users
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

ALTER TABLE users DROP CONSTRAINT uk6dotkott2kjsp8vw4d0m25fb7;

CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));
