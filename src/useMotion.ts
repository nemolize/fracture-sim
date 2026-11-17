import { useCallback, useEffect, useRef, useState } from "react";

import type { Settings } from "@/settings";
import { MotionTracker, readMotion } from "@/sim/motion";

/** How long the probe waits for a first usable reading; chosen empirically, no fixed source. */
const PROBE_MS = 1000;

type MotionSupport = "checking" | "supported" | "unsupported";

export interface MotionControl {
  tracker: MotionTracker;
  support: MotionSupport;
  enabled: boolean;
  notice: string | null;
  setEnabled: (enabled: boolean) => void;
}

type PermissionRequest = () => Promise<string>;

const isPermissionRequest = (value: unknown): value is PermissionRequest =>
  typeof value === "function";

/**
 * iOS and iPadOS Safari send events only after the user allows it, and report
 * every axis with the opposite sign to the specification. Chromium also has
 * `requestPermission` but sends events without it, so it cannot tell the two apart.
 */
const isIos = (): boolean => {
  const agent = navigator.userAgent;
  return (
    ["iPad", "iPhone", "iPod"].some((name) => agent.includes(name)) ||
    (agent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
};

const permissionRequest = (): PermissionRequest | null => {
  const request: unknown = Reflect.get(DeviceMotionEvent, "requestPermission");
  return isIos() && isPermissionRequest(request)
    ? () => request.call(DeviceMotionEvent)
    : null;
};

const detectSupport = (): MotionSupport => {
  if (typeof DeviceMotionEvent === "undefined") return "unsupported";
  return permissionRequest() === null ? "checking" : "supported";
};

const usable = (event: DeviceMotionEvent): boolean =>
  readMotion(event, 0, false).tilt !== null;

export const useMotion = (settings: Settings): MotionControl => {
  const [tracker] = useState(() => new MotionTracker());
  const [support, setSupport] = useState(detectSupport);
  const [enabled, setEnabledState] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const smoothingRef = useRef(settings.tiltSmoothing);
  useEffect(() => {
    smoothingRef.current = settings.tiltSmoothing;
  });

  const probing = support === "checking";
  useEffect(() => {
    if (!probing) return;
    const onMotion = (event: DeviceMotionEvent): void => {
      if (usable(event)) setSupport("supported");
    };
    window.addEventListener("devicemotion", onMotion);
    const timer = window.setTimeout(() => {
      setSupport("unsupported");
    }, PROBE_MS);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.clearTimeout(timer);
    };
  }, [probing]);

  useEffect(() => {
    if (!enabled) return;
    const flipped = isIos();
    const onMotion = (event: DeviceMotionEvent): void => {
      tracker.update(
        readMotion(event, window.screen.orientation.angle, flipped),
        event.timeStamp,
        smoothingRef.current,
      );
    };
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      tracker.reset();
    };
  }, [enabled, tracker]);

  const setEnabled = useCallback((on: boolean) => {
    if (!on) {
      setEnabledState(false);
      setNotice(null);
      return;
    }
    const request = permissionRequest();
    if (request === null) {
      setNotice(null);
      setEnabledState(true);
      return;
    }
    request().then(
      (answer) => {
        if (answer === "granted") {
          setNotice(null);
          setEnabledState(true);
        } else {
          setNotice("Motion access was denied, so tilt stays off.");
        }
      },
      (error: unknown) => {
        setNotice(
          `Motion access failed (${String(error)}), so tilt stays off.`,
        );
      },
    );
  }, []);

  return { tracker, support, enabled, notice, setEnabled };
};
