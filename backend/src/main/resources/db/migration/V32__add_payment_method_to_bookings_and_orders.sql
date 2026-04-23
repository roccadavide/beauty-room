-- V32: aggiunge metodo di pagamento a prenotazioni e ordini
--      PAID_ONLINE = pagamento Stripe (default storico)
--      PAY_IN_STORE = pagamento in loco (cliente di fiducia)

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'PAID_ONLINE';

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'PAID_ONLINE';
