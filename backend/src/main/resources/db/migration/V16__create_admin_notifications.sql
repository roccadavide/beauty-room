CREATE TABLE admin_notifications (
    id           UUID          NOT NULL DEFAULT gen_random_uuid(),
    type         VARCHAR(40)   NOT NULL,
    title        VARCHAR(200)  NOT NULL,
    body         VARCHAR(500),
    entity_id    UUID,
    entity_type  VARCHAR(50),
    read_at      TIMESTAMP,
    created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_admin_notifications PRIMARY KEY (id)
);

CREATE INDEX idx_notif_unread  ON admin_notifications (read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notif_created ON admin_notifications (created_at DESC);
