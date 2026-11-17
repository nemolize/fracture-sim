import { readFileSync } from "node:fs";

import { parse } from "yaml";

export interface Step {
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

export function requireStep(
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

export function requireRun(step: Step, label: string): string {
  if (step.run === undefined) {
    throw new Error(`${label} has no run script`);
  }
  return step.run;
}
