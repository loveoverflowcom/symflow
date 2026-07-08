CREATE TABLE IF NOT EXISTS step_executions (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID         NOT NULL REFERENCES flow_runs(id),
    step_id         VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
    resolved_inputs JSONB,
    outputs         JSONB,
    agent_logs      JSONB,
    error           TEXT,
    executed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_step_exec_run ON step_executions(run_id);
CREATE INDEX IF NOT EXISTS idx_step_exec_status ON step_executions(status);
