import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadWorkflow, requireRun, requireStep } from "./workflow-yaml.ts";

const WORKFLOW_FILE = ".github/workflows/ci.yml";
const workflow = loadWorkflow(WORKFLOW_FILE);

const filterScript = requireRun(
  requireStep(workflow, WORKFLOW_FILE, "SweepFilter", "filter"),
  "the filter step",
);
const gateScript = requireRun(
  requireStep(workflow, WORKFLOW_FILE, "E2ETests", "sweep-gate"),
  "the gate step",
);

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ci-workflow-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function git(...args: string[]): string {
  const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function commit(files: string[]): string {
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file}\n${String(Math.random())}\n`);
  }
  git("add", "--all");
  git(
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--message",
    "change",
  );
  return git("rev-parse", "HEAD");
}

function runFilter(base: string) {
  const output = join(dir, "github-output");
  writeFileSync(output, "");
  const result = spawnSync("bash", ["-e", "-c", filterScript], {
    cwd: dir,
    encoding: "utf8",
    env: {
      PATH: process.env["PATH"] ?? "",
      BASE_SHA: base,
      GITHUB_OUTPUT: output,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    output: readFileSync(output, "utf8"),
  };
}

function sweepRunsFor(files: string[]): boolean {
  git("init", "--quiet");
  const base = commit(["README.md"]);
  commit(files);
  const result = runFilter(base);
  expect(result.status).toBe(0);
  expect(["run=true\n", "run=false\n"]).toContain(result.output);
  return result.output === "run=true\n";
}

describe("SweepFilter job", () => {
  it.each([
    "src/sim/contact.ts",
    "src/gpu/solver.ts",
    "src/gpu/shaders/step.wgsl",
    "src/harness/main.ts",
    "e2e-tests/gpu.spec.ts",
    "playwright.config.ts",
    "harness.html",
    ".github/workflows/ci.yml",
  ])("runs the sweep for a change to %s", (file) => {
    expect(sweepRunsFor([file])).toBe(true);
  });

  it("runs the sweep when one of several changed files is a sweep path", () => {
    expect(sweepRunsFor(["docs/notes.md", "src/sim/chunks.ts", "a.md"])).toBe(
      true,
    );
  });

  it.each([
    "README.md",
    "src/App.tsx",
    "src/utils/format.ts",
    "src/simulation-notes.md",
    "pnpm-lock.yaml",
    ".github/workflows/deploy.yml",
    "docs/a file with spaces.md",
  ])("skips the sweep for a change to %s", (file) => {
    expect(sweepRunsFor([file])).toBe(false);
  });

  it("matches whole names, so a newline inside a name never forms a sweep path", () => {
    expect(sweepRunsFor(["docs/x\nsrc/sim/y"])).toBe(false);
  });

  it("runs the sweep when the range lists no changed file", () => {
    git("init", "--quiet");
    const head = commit(["README.md"]);

    expect(runFilter(head).output).toBe("run=true\n");
  });

  it("runs the sweep, with an error annotation, when the base cannot be diffed", () => {
    git("init", "--quiet");
    commit(["README.md"]);

    const result = runFilter("0".repeat(40));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("::error::");
    expect(result.output).toBe("run=true\n");
  });
});

describe("StabilitySweep job", () => {
  const sweep = workflow.jobs["StabilitySweep"];

  it("runs only when the filter says so", () => {
    expect(sweep?.needs).toBe("SweepFilter");
    expect(sweep?.if).toBe("${{ needs.SweepFilter.outputs.run == 'true' }}");
  });
});

function runGate(filter: string, run: string, sweep: string) {
  const result = spawnSync("bash", ["-e", "-c", gateScript], {
    encoding: "utf8",
    env: {
      PATH: process.env["PATH"] ?? "",
      FILTER_RESULT: filter,
      SWEEP_RUN: run,
      SWEEP_RESULT: sweep,
    },
  });
  return { status: result.status, stdout: result.stdout };
}

describe("E2ETests sweep gate", () => {
  it("waits for the filter and the sweep, and comes before any other step", () => {
    const e2e = workflow.jobs["E2ETests"];

    expect(e2e?.needs).toEqual(["SweepFilter", "StabilitySweep"]);
    expect(e2e?.steps[0]?.id).toBe("sweep-gate");
  });

  it.each([
    ["success", "true", "success"],
    ["success", "false", "skipped"],
  ])("passes for filter %s, run=%s and sweep %s", (filter, run, sweep) => {
    expect(runGate(filter, run, sweep).status).toBe(0);
  });

  it.each([
    ["success", "true", "failure"],
    ["success", "true", "cancelled"],
    ["success", "true", "skipped"],
    ["success", "false", "success"],
    ["success", "false", "failure"],
    ["success", "", "skipped"],
    ["failure", "", "skipped"],
    ["failure", "false", "skipped"],
    ["cancelled", "false", "skipped"],
    ["skipped", "false", "skipped"],
  ])("fails for filter %s, run=%s and sweep %s", (filter, run, sweep) => {
    const result = runGate(filter, run, sweep);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::");
  });
});
