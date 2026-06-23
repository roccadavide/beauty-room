-- ============================================================
-- V80 – Re-normalize customers.phone_normalized to canonical E.164 (+39…)
-- ------------------------------------------------------------
-- Moves the customer dedup key from digits-only (V73) to true E.164 with the
-- leading '+', so a customer entered with "+39 347…" and one entered with the
-- bare "347…" dedup to ONE record going forward. The human-readable `phone`
-- column is left untouched (display stays verbatim).
--
-- ⚠ Java/SQL PARITY: the CASE below mirrors PhoneNormalizer.normalize() and
-- frontend/src/utils/reminders.js → normalizeItalianPhone() BRANCH-FOR-BRANCH,
-- operating on the SAME digits-only operand. Both first strip a leading '00',
-- then apply the same four ordered branches, so the key written here matches the
-- key computed at lookup time (findByPhoneNormalized) byte-for-byte. Do NOT
-- "simplify" one side without the other.
--
--   reminders.js / PhoneNormalizer        ->  CASE branch (c = digits, '00' stripped)
--   startsWith("39") && length>=11  -> "+"c   ->  c ~ '^39[0-9]{9,}$'  -> '+'  || c   (B1)
--   length==10 && startsWith("3")   -> "+39"c ->  c ~ '^3[0-9]{9}$'    -> '+39'|| c   (B2)
--   fallback startsWith("39")       -> "+"c   ->  c LIKE '39%'         -> '+'  || c   (B3)
--   fallback else (incl. landline 0…)-> "+39"c->  ELSE                 -> '+39'|| c   (B4)
--   empty after digit-reduction     -> null   ->  c = ''              -> NULL
--
-- (This DIVERGES from the first-draft candidate, which is WRONG vs reminders.js:
--  the candidate ELSE was '+'||d — but reminders.js prepends '39' to anything not
--  already 39-prefixed (B4) — and its landline branch '^0[0-9]{4,}$' would swallow
--  '0039…' before the '0039' branch. Stripping '00' up front + a '+39' fallback is
--  the faithful mirror.)
--
-- Strict order (MANDATORY): drop unique index -> re-normalize -> duplicate guard
-- -> recreate unique index. The index is dropped FIRST because the UPDATE rewrites
-- the keyed column and could momentarily collide. Postgres wraps this migration in
-- ONE transaction, so any failure (incl. the guard's RAISE) rolls back the WHOLE
-- thing — never half-applied.
--
-- PRECONDITION (run by the developer BEFORE deploying — local first, then prod):
--   SELECT phone_normalized, count(*)
--   FROM public.customers
--   WHERE phone_normalized IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;
--   -> prod returned ZERO rows at audit time. The guard (step 3) is the net if it didn't.
-- ============================================================

-- 1. Drop the unique index so the re-normalization UPDATE can rewrite keys freely.
DROP INDEX IF EXISTS ux_customer_phone;

-- 2. Re-normalize every non-null key from digits-only to canonical E.164.
--    `c` = the stored digits with a single leading international '00' stripped,
--    matching PhoneNormalizer's pre-step. Branches B1..B4 mirror reminders.js.
WITH norm AS (
    SELECT customer_id,
           regexp_replace(phone_normalized, '^00', '') AS c
    FROM public.customers
    WHERE phone_normalized IS NOT NULL
)
UPDATE public.customers AS cu
   SET phone_normalized = CASE
        WHEN norm.c = ''                THEN NULL            -- empty after strip (e.g. "00") -> out of index
        WHEN norm.c ~ '^39[0-9]{9,}$'   THEN '+'   || norm.c -- B1 already 39 country code, full length
        WHEN norm.c ~ '^3[0-9]{9}$'     THEN '+39' || norm.c -- B2 bare IT mobile (10 digits, starts 3)
        WHEN norm.c LIKE '39%'          THEN '+'   || norm.c -- B3 39-prefixed but shorter
        ELSE                                 '+39' || norm.c -- B4 fallback: force 39 (incl. landline 0…)
   END
  FROM norm
 WHERE cu.customer_id = norm.customer_id;

-- 3. Defensive duplicate guard — abort loudly (rolls back the whole migration) if
--    the E.164 re-normalization collapsed two distinct digits-only keys into one.
DO $$
DECLARE
    dup_groups integer;
BEGIN
    SELECT count(*) INTO dup_groups
    FROM (
        SELECT phone_normalized
        FROM public.customers
        WHERE phone_normalized IS NOT NULL
        GROUP BY phone_normalized
        HAVING count(*) > 1
    ) d;

    IF dup_groups > 0 THEN
        RAISE EXCEPTION
            'V80 aborted: % normalized-phone duplicate group(s) after E.164 re-normalization — merge them first.',
            dup_groups;
    END IF;
END $$;

-- 4. Recreate the partial unique index on the new E.164 key.
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_phone
    ON public.customers (phone_normalized)
    WHERE phone_normalized IS NOT NULL;
