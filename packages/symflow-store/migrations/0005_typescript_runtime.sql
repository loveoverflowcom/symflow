-- JSON/YAML workflows cannot be converted safely to arbitrary TypeScript.
-- Start the browser-runtime era with an explicit clean slate.
TRUNCATE TABLE step_executions, flow_runs, flows;
DROP TABLE step_executions;

ALTER TABLE flow_runs
    ADD COLUMN output JSONB,
    ADD COLUMN execution_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN error TEXT;

COMMENT ON COLUMN flows.dsl_script IS 'TypeScript workflow source code';
COMMENT ON COLUMN flow_runs.execution_logs IS 'ExecutionLog array produced by the browser runtime';
