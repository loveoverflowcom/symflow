ALTER TABLE flows
    ADD COLUMN IF NOT EXISTS graph JSONB;

COMMENT ON COLUMN flows.graph IS 'Serializable visual workflow graph used to restore the editor';
