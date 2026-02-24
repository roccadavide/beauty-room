ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'PENDING',                 -- <--- tienilo per compatibilità con righe vecchie
    'PENDING_PAYMENT',
    'PAID_PENDING_PICKUP',
    'CANCELED',
    'COMPLETED',
    'FAILED',
    'REFUNDED',
    'SHIPPED'
  ));