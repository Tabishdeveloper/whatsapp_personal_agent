CREATE TABLE IF NOT EXISTS chat_history (
    id          BIGSERIAL PRIMARY KEY,
    contact_id  TEXT        NOT NULL,
    role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_contact_created
    ON chat_history (contact_id, created_at DESC);
