import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@/settings";
import { GRAVITY } from "@/sim/contact";

import { useMotion } from "./useMotion";

const TUNING = { inertiaScale: 1, inertiaCap: 100 };

const motionEvent = (
  withGravity: { x: number | null; y: number | null; z: number | null } | null,
  acceleration: { x: number | null; y: number | null; z: number | null } | null,
  timeStamp: number,
): Event =>
  Object.defineProperties(new Event("devicemotion"), {
    accelerationIncludingGravity: { value: withGravity },
    acceleration: { value: acceleration },
    timeStamp: { value: timeStamp },
  });

const upright = { x: 0, y: GRAVITY, z: 0 };
const rightEdgeDown = { x: -GRAVITY, y: 0, z: 0 };

const setAngle = (angle: number): void => {
  Object.defineProperty(window.screen, "orientation", {
    value: { angle },
    configurable: true,
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  setAngle(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "userAgent");
  Reflect.deleteProperty(navigator, "maxTouchPoints");
});

describe("without a motion API", () => {
  it("reports the device as unsupported", () => {
    vi.stubGlobal("DeviceMotionEvent", undefined);
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    expect(result.current.support).toBe("unsupported");
    expect(result.current.enabled).toBe(false);
  });
});

describe("where events arrive without asking", () => {
  beforeEach(() => {
    vi.stubGlobal("DeviceMotionEvent", vi.fn());
  });

  it("checks first, then supports the device once a usable reading arrives", () => {
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    expect(result.current.support).toBe("checking");
    act(() => {
      window.dispatchEvent(motionEvent(null, null, 0));
    });
    expect(result.current.support).toBe("checking");
    act(() => {
      window.dispatchEvent(motionEvent(upright, null, 1));
    });
    expect(result.current.support).toBe("supported");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.support).toBe("supported");
  });

  it("supports a device that lies flat while the page loads", () => {
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    act(() => {
      window.dispatchEvent(motionEvent({ x: 0, y: 0, z: GRAVITY }, null, 0));
    });
    expect(result.current.support).toBe("supported");
  });

  describe("while the page is hidden", () => {
    const setHidden = (hidden: boolean): void => {
      Object.defineProperty(document, "hidden", {
        value: hidden,
        configurable: true,
      });
    };
    afterEach(() => {
      Reflect.deleteProperty(document, "hidden");
    });

    it("waits for the page to show before giving up", () => {
      setHidden(true);
      const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.support).toBe("checking");
      setHidden(false);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.support).toBe("unsupported");
    });

    it("stops the clock when the page hides mid-probe", () => {
      const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
      act(() => {
        vi.advanceTimersByTime(500);
      });
      setHidden(true);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.support).toBe("checking");
    });
  });

  it("gives up when no reading comes", () => {
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.support).toBe("unsupported");
  });

  it("starts on once a usable reading arrives", () => {
    const { result } = renderHook(() =>
      useMotion({ ...DEFAULT_SETTINGS, tiltSmoothing: 0 }),
    );
    expect(result.current.enabled).toBe(false);
    act(() => {
      window.dispatchEvent(motionEvent(upright, null, 0));
    });
    expect(result.current.enabled).toBe(true);
    act(() => {
      window.dispatchEvent(motionEvent(rightEdgeDown, null, 10));
    });
    expect(result.current.tracker.gravity(TUNING, 10).x).toBeCloseTo(GRAVITY);
  });

  it("stays off when the user turned it off before the sensor answered", () => {
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    act(() => {
      result.current.setEnabled(false);
      window.dispatchEvent(motionEvent(upright, null, 0));
    });
    expect(result.current.support).toBe("supported");
    expect(result.current.enabled).toBe(false);
  });

  it("stays off when no reading comes", () => {
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.enabled).toBe(false);
  });

  it("feeds tilt and shake into the tracker only while enabled", () => {
    const { result } = renderHook(() =>
      useMotion({ ...DEFAULT_SETTINGS, tiltSmoothing: 0 }),
    );
    act(() => {
      window.dispatchEvent(motionEvent(upright, null, 0));
    });
    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.enabled).toBe(true);
    expect(result.current.notice).toBeNull();

    act(() => {
      window.dispatchEvent(
        motionEvent(rightEdgeDown, { x: 2, y: 0, z: 0 }, 10),
      );
    });
    const tilted = result.current.tracker.gravity(TUNING, 10);
    expect(tilted.x).toBeCloseTo(GRAVITY - 2);
    expect(tilted.y).toBeCloseTo(0);

    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.enabled).toBe(false);
    const off = result.current.tracker.gravity(TUNING, 0);
    expect(off.x).toBeCloseTo(0);
    expect(off.y).toBeCloseTo(-GRAVITY);
    act(() => {
      window.dispatchEvent(motionEvent(rightEdgeDown, null, 20));
    });
    expect(result.current.tracker.gravity(TUNING, 20).x).toBeCloseTo(0);
  });

  it("reads the screen angle when each event arrives", () => {
    const { result } = renderHook(() =>
      useMotion({ ...DEFAULT_SETTINGS, tiltSmoothing: 0 }),
    );
    act(() => {
      window.dispatchEvent(motionEvent(upright, null, 0));
      result.current.setEnabled(true);
    });
    setAngle(90);
    act(() => {
      window.dispatchEvent(motionEvent({ x: GRAVITY, y: 0, z: 0 }, null, 10));
    });
    const { x, y } = result.current.tracker.gravity(TUNING, 10);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-GRAVITY);
  });

  it("applies the smoothing setting live", () => {
    const { result, rerender } = renderHook(
      (smoothing: number) =>
        useMotion({ ...DEFAULT_SETTINGS, tiltSmoothing: smoothing }),
      { initialProps: 10 },
    );
    act(() => {
      window.dispatchEvent(motionEvent(upright, null, 0));
      result.current.setEnabled(true);
    });
    act(() => {
      window.dispatchEvent(motionEvent(upright, null, 0));
    });
    act(() => {
      window.dispatchEvent(motionEvent(rightEdgeDown, null, 10));
    });
    expect(result.current.tracker.gravity(TUNING, 10).x).toBeLessThan(0.1);
    rerender(0);
    act(() => {
      window.dispatchEvent(motionEvent(rightEdgeDown, null, 20));
    });
    expect(result.current.tracker.gravity(TUNING, 20).x).toBeCloseTo(GRAVITY);
  });
});

const setNavigator = (userAgent: string, maxTouchPoints: number): void => {
  Object.defineProperty(navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: maxTouchPoints,
    configurable: true,
  });
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const ANDROID = "Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile";

const stubPermission = (request: () => Promise<string>): void => {
  vi.stubGlobal(
    "DeviceMotionEvent",
    Object.assign(vi.fn(), { requestPermission: request }),
  );
};

describe("where Chromium offers requestPermission but needs no answer", () => {
  it("probes for events and reads the specification's signs", () => {
    const request = vi.fn(() => Promise.resolve("prompt"));
    setNavigator(ANDROID, 5);
    stubPermission(request);
    const { result } = renderHook(() =>
      useMotion({ ...DEFAULT_SETTINGS, tiltSmoothing: 0 }),
    );
    expect(result.current.support).toBe("checking");
    act(() => {
      window.dispatchEvent(motionEvent(upright, null, 0));
    });
    expect(result.current.support).toBe("supported");
    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.enabled).toBe(true);
    expect(request).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(motionEvent(rightEdgeDown, null, 10));
    });
    expect(result.current.tracker.gravity(TUNING, 10).x).toBeCloseTo(GRAVITY);
  });
});

describe("where the browser asks permission", () => {
  beforeEach(() => {
    setNavigator(IPHONE, 5);
  });

  it("treats an iPad that reports itself as a Mac like an iPhone", () => {
    setNavigator(IPAD_AS_MAC, 5);
    stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    expect(result.current.support).toBe("supported");
  });

  it("does not take a Mac without a touch screen for an iPad", () => {
    setNavigator(IPAD_AS_MAC, 0);
    stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    expect(result.current.support).toBe("checking");
  });

  it("supports the device without waiting for an event", () => {
    stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    expect(result.current.support).toBe("supported");
  });

  it("starts off until the user turns it on", () => {
    stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    expect(result.current.enabled).toBe(false);
  });

  it("turns on after the user grants access", async () => {
    const request = vi.fn(() => Promise.resolve("granted"));
    stubPermission(request);
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledOnce();
    expect(result.current.enabled).toBe(true);
  });

  it("reverses the signs these browsers report", async () => {
    stubPermission(() => Promise.resolve("granted"));
    const { result } = renderHook(() =>
      useMotion({ ...DEFAULT_SETTINGS, tiltSmoothing: 0 }),
    );
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    act(() => {
      window.dispatchEvent(motionEvent({ x: GRAVITY, y: 0, z: 0 }, null, 0));
    });
    expect(result.current.tracker.gravity(TUNING, 0).x).toBeCloseTo(GRAVITY);
  });

  it("stays off and says so when the user denies access", async () => {
    stubPermission(() => Promise.resolve("denied"));
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(result.current.enabled).toBe(false);
    expect(result.current.notice).toMatch(/denied/);
  });

  it("stays off and names the failure when the request rejects", async () => {
    stubPermission(() => Promise.reject(new Error("not allowed")));
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    expect(result.current.enabled).toBe(false);
    expect(result.current.notice).toMatch(/not allowed/);
  });

  it("clears the notice when turned off", async () => {
    stubPermission(() => Promise.resolve("denied"));
    const { result } = renderHook(() => useMotion(DEFAULT_SETTINGS));
    await act(async () => {
      result.current.setEnabled(true);
      await Promise.resolve();
    });
    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.notice).toBeNull();
  });
});
