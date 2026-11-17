import { readFileSync } from "node:fs";

import { parse } from "yaml";

interface Step {
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
}

interface Job {
  needs?: string | string[];
  if?: string;
  steps: Step[];
}

export interface Workflow {
  concurrency?: { group: string };
  jobs: Record<string, Job>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkflow(value: unknown): value is Workflow {
  if (!isRecord(value) || !isRecord(value["jobs"])) {
    return false;
  }
  return Object.values(value["jobs"]).every(
    (job) => isRecord(job) && Array.isArray(job["steps"]),
  );
}

export function loadWorkflow(file: string): Workflow {
  const parsed: unknown = parse(readFileSync(file, "utf8"));
  if (!isWorkflow(parsed)) {
    throw new Error(`${file} is not a workflow with jobs and steps`);
  }
  return parsed;
}

function requireStep(
  workflow: Workflow,
  file: string,
  job: string,
  id: string,
): Step {
  const step = workflow.jobs[job]?.steps.find(
    (candidate) => candidate.id === id,
  );
  if (step === undefined) {
    throw new Error(`${file} has no step "${id}" in job "${job}"`);
  }
  return step;
}

export function requireRunScript(
  workflow: Workflow,
  file: string,
  job: string,
  id: string,
): string {
  const run = requireStep(workflow, file, job, id).run;
  if (run === undefined) {
    throw new Error(`${file} step "${id}" in job "${job}" has no run script`);
  }
  return run;
}
