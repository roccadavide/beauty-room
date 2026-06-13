-- PROMPT B: carry the pre-move start time to the async "appuntamento spostato" email.
-- The email is sent by the outbox worker, which reloads the booking and would otherwise
-- only see the NEW start time; this column persists the previous start so the email can
-- show "Prima → Ora". Nullable + mirrors start_time's type exactly (ddl-auto=validate).
ALTER TABLE bookings ADD COLUMN previous_start_time timestamp(6) without time zone NULL;
