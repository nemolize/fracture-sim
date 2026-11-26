const WINDOW_MS = 500;

export class FrameMeter {
  private frames = 0;
  private start: number | null = null;

  private readonly onRate: (fps: number) => void;

  constructor(onRate: (fps: number) => void) {
    this.onRate = onRate;
  }

  tick(now: number, changed: boolean): void {
    if (this.start === null) {
      this.start = now;
      return;
    }
    if (changed) this.frames += 1;
    const elapsed = now - this.start;
    if (elapsed >= WINDOW_MS) {
      this.onRate((this.frames * 1000) / elapsed);
      this.frames = 0;
      this.start = now;
    }
  }

  restart(): void {
    this.start = null;
    this.frames = 0;
  }
}
