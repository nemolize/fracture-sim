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
          // Physics tests step real Rapier worlds.
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
        // WebGPU render pipeline, driven by e2e-tests/rigid.spec.ts.
        "src/rigid/renderer.ts",
        // Worker entry point, exercised through both the app and harness in e2e-tests/rigid.spec.ts.
        "src/rigid/worker.ts",
        // Browser harness driven by e2e-tests/rigid.spec.ts.
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
