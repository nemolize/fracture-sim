import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e-tests/**"],
    projects: [
      {
        test: {
          name: "dom",
          environment: "happy-dom",
          setupFiles: ["./src/test-setup.ts"],
          // The solver tests step a real mesh thousands of times.
          testTimeout: 30_000,
          include: ["src/**/*.{test,spec}.{js,ts,tsx}"],
        },
      },
      {
        test: {
          name: "node",
          include: ["*.{test,spec}.{js,ts}"],
        },
      },
    ],
    coverage: {
      // json + json-summary feed the coverage report action in CI.
      reporter: ["text", "html", "json", "json-summary"],
      reportOnFailure: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.*",
        "src/**/*.d.ts",
        "src/test-setup.ts",
        "src/main.tsx",
        // Test doubles, used only by the unit tests.
        "src/gpu/fakes.ts",
        // Needs a real canvas and requestAnimationFrame; e2e-tests/index.spec.ts drives it.
        "src/FractureCanvas.tsx",
        // Create buffers, pipelines and passes on a WebGPU device; the e2e GPU
        // tests in e2e-tests/gpu.spec.ts run them against the CPU reference.
        "src/gpu/solver.ts",
        // Render pipeline; e2e-tests/gpu.spec.ts reads its pixels back in every view.
        "src/gpu/renderer.ts",
        // requestAnimationFrame loop; e2e-tests/index.spec.ts runs it in the app
        // and e2e-tests/gpu.spec.ts measures its pacing on a physical GPU.
        "src/gpu/loop.ts",
        // The page the e2e tests drive; it is test support, run by e2e-tests/gpu.spec.ts.
        "src/harness/**",
      ],
      thresholds: {
        autoUpdate: true,
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
