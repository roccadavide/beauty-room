CREATE TABLE post_its (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    color       VARCHAR(7)  NOT NULL DEFAULT '#b8976a',
    due_date    DATE,
    done        BOOLEAN     NOT NULL DEFAULT FALSE,
    priority    INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_post_its PRIMARY KEY (id)
);

CREATE INDEX idx_post_its_due ON post_its (due_date) WHERE done = FALSE;
