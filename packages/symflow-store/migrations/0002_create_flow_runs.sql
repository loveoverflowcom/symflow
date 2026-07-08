CREATE TABLE IF NOT EXISTS flow_runs (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id        VARCHAR(100) NOT NULL REFERENCES flows(id),
    status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED')),
    initial_inputs  JSONB,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON flow_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_created_at ON flow_runs(created_at DESC);
