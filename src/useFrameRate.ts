import { useEffect, useState } from "react";

const WINDOW_MS = 500;

export const useFrameRate = (): number | null => {
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    let frames = 0;
    let start: number | null = null;
    let animation = 0;
    const tick = (now: number): void => {
      if (start === null) {
        start = now;
      } else {
        frames += 1;
        const elapsed = now - start;
        if (elapsed >= WINDOW_MS) {
          setFps((frames * 1000) / elapsed);
          frames = 0;
          start = now;
        }
      }
      animation = requestAnimationFrame(tick);
    };
    const restart = (): void => {
      start = null;
      frames = 0;
    };
    document.addEventListener("visibilitychange", restart);
    animation = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("visibilitychange", restart);
      cancelAnimationFrame(animation);
    };
  }, []);
  return fps;
};
