/* eslint-disable @typescript-eslint/no-non-null-assertion -- Indices are bounded by validated polygon and seed lengths. */
import { describe, expect, it } from "vitest";

import { polygonMoments, signedArea } from "./polygon";
import type { Piece } from "./split";
import { splitConvex } from "./split";
import type { Vec2 } from "./vec2";

const BOUND = 1e-12;

/** Small deterministic generator, so a failing case can be replayed. */
const random = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Convex n-gon on an ellipse, off-centre and rotated, so nothing is symmetric. */
const parentPolygon = (n: number): Vec2[] =>
  Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * (i + 0.13 * Math.sin(3 * i))) / n;
    const x = 2.3 * Math.cos(angle);
    const y = 1.1 * Math.sin(angle);
    return { x: 0.8 * x - 0.6 * y + 5, y: 0.6 * x + 0.8 * y - 3 };
  });

const interiorSeeds = (
  ring: readonly Vec2[],
  count: number,
  next: () => number,
): Vec2[] => {
  const xs = ring.map((v) => v.x);
  const ys = ring.map((v) => v.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const seeds: Vec2[] = [];
  let attempts = 0;
  while (seeds.length < count) {
    if (++attempts > 100000) throw new Error("Could not sample interior seeds");
    const p = { x: x0 + (x1 - x0) * next(), y: y0 + (y1 - y0) * next() };
    const inside = ring.every((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) > 0;
    });
    const apart = seeds.every(
      (s) =>
        Math.hypot(s.x - p.x, s.y - p.y) >
        Math.sqrt(polygonMoments(ring).area) * 1e-4,
    );
    if (inside && apart) seeds.push(p);
  }
  return seeds;
};

interface Body {
  domain: Vec2[];
  area: number;
  polarAreaMoment: number;
  v: Vec2;
  omega: number;
}

const bodyOf = (piece: Piece, parent: Body): Body => {
  const r = piece.centroidOffset;
  return {
    domain: piece.domain,
    area: piece.area,
    polarAreaMoment: piece.polarAreaMoment,
    v: {
      x: parent.v.x - parent.omega * r.y,
      y: parent.v.y + parent.omega * r.x,
    },
    omega: parent.omega,
  };
};

const splitAndCheckConservation = (
  parent: Body,
  count: number,
  next: () => number,
): Body[] => {
  const pieces = splitConvex(
    parent.domain,
    interiorSeeds(parent.domain, count, next),
  );
  expect(pieces).toHaveLength(count);
  const children = pieces.map((piece) => bodyOf(piece, parent));
  let area = 0;
  let px = 0;
  let py = 0;
  let angular = 0;
  pieces.forEach((piece, i) => {
    const child = children[i]!;
    const r = piece.centroidOffset;
    area += piece.area;
    px += piece.area * child.v.x;
    py += piece.area * child.v.y;
    angular +=
      piece.area * (r.x * child.v.y - r.y * child.v.x) +
      piece.polarAreaMoment * parent.omega;
  });
  expect(Math.abs(area - parent.area) / parent.area).toBeLessThanOrEqual(BOUND);
  const linear = Math.hypot(parent.area * parent.v.x, parent.area * parent.v.y);
  expect(
    Math.hypot(px - parent.area * parent.v.x, py - parent.area * parent.v.y) /
      linear,
  ).toBeLessThanOrEqual(BOUND);
  const expected = parent.polarAreaMoment * parent.omega;
  expect(Math.abs(angular - expected) / Math.abs(expected)).toBeLessThanOrEqual(
    BOUND,
  );
  return children;
};

describe("splitConvex conserves area and momentum over three generations", () => {
  for (const count of [8, 16, 32]) {
    it(`${String(count)} seeds, parents with 4-8 vertices`, () => {
      for (let n = 4; n <= 8; n++) {
        const next = random(1000 * count + n);
        const ring = parentPolygon(n);
        const moments = polygonMoments(ring);
        const root: Body = {
          domain: ring.map((v) => ({
            x: v.x - moments.centroid.x,
            y: v.y - moments.centroid.y,
          })),
          area: moments.area,
          polarAreaMoment: moments.polarAreaMoment,
          v: { x: 1.7, y: -0.4 },
          omega: 2.9,
        };
        const first = splitAndCheckConservation(root, count, next);
        const second = first.flatMap((body) =>
          splitAndCheckConservation(body, count, next),
        );
        const third = second.flatMap((body) =>
          splitAndCheckConservation(body, count, next),
        );
        expect(third.length).toBeGreaterThan(0);
        const total = second.reduce((sum, body) => sum + body.area, 0);
        expect(Math.abs(total - root.area) / root.area).toBeLessThanOrEqual(
          BOUND,
        );
      }
    });
  }
});

describe("collision polygon reduction", () => {
  // Nine neighbours at uneven radii around one seed: its cell has nine vertices.
  const parent: Vec2[] = [
    { x: -20, y: -20 },
    { x: 20, y: -20 },
    { x: 20, y: 20 },
    { x: -20, y: 20 },
  ];
  const ring = Array.from({ length: 9 }, (_, i) => {
    const angle = (2 * Math.PI * i) / 9;
    const radius = 1 + 0.15 * Math.sin(2.3 * i);
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
  const pieces = splitConvex(parent, [{ x: 0, y: 0 }, ...ring]);
  const centre = pieces[0]!;

  it("needs the reduction and keeps the true values", () => {
    expect(centre.domain).toHaveLength(9);
    expect(centre.polygon).toHaveLength(8);
    const true_ = polygonMoments(centre.domain);
    expect(centre.area).toBeCloseTo(true_.area, 14);
    expect(centre.polarAreaMoment).toBeCloseTo(true_.polarAreaMoment, 14);
    expect(polygonMoments(centre.polygon).area).toBeLessThan(centre.area);
  });

  it("drops the vertex whose triangle with its neighbours is the smallest", () => {
    const d = centre.domain;
    const cost = d.map((v, i) => {
      const a = d[(i + 8) % 9]!;
      const b = d[(i + 1) % 9]!;
      return Math.abs((v.x - a.x) * (b.y - a.y) - (v.y - a.y) * (b.x - a.x));
    });
    const dropped = d[cost.indexOf(Math.min(...cost))]!;
    expect(centre.polygon).not.toContainEqual(dropped);
    expect(
      centre.polygon.every((p) => d.some((q) => q.x === p.x && q.y === p.y)),
    ).toBe(true);
  });

  it("splits the true domain again with the area and momentum conserved", () => {
    const body: Body = {
      domain: centre.domain,
      area: centre.area,
      polarAreaMoment: centre.polarAreaMoment,
      v: { x: -0.9, y: 2.2 },
      omega: -1.3,
    };
    splitAndCheckConservation(body, 8, random(7));
    const reduced = splitConvex(
      centre.polygon,
      interiorSeeds(centre.polygon, 8, random(7)),
    );
    const lost = reduced.reduce((sum, piece) => sum + piece.area, 0);
    expect(lost).toBeLessThan(centre.area * (1 - 1e-6));
  });
});

describe("splitConvex input handling", () => {
  const square: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ];
  const seeds: Vec2[] = [
    { x: 1, y: 1 },
    { x: 3, y: 3 },
  ];

  it("returns the whole parent for one seed", () => {
    const [only] = splitConvex(square, [{ x: 1, y: 3 }]);
    expect(only?.area).toBeCloseTo(16, 12);
    expect(only?.centroidOffset.x).toBeCloseTo(0, 12);
    expect(only?.centroidOffset.y).toBeCloseTo(0, 12);
    expect(only?.polarAreaMoment).toBeCloseTo((2 * (16 * 16)) / 12, 10);
  });

  it("returns pieces in seed order with offsets from the parent centroid", () => {
    const [a, b] = splitConvex(square, seeds);
    expect(a!.area + b!.area).toBeCloseTo(16, 12);
    expect(a!.centroidOffset.x).toBeLessThan(0);
    expect(b!.centroidOffset.x).toBeGreaterThan(0);
  });

  it("gives a clockwise parent the same pieces", () => {
    const forward = splitConvex(square, seeds);
    const reversed = splitConvex([...square].reverse(), seeds);
    expect(reversed.map((p) => p.area)).toEqual(forward.map((p) => p.area));
    expect(reversed.map((p) => p.polarAreaMoment)).toEqual(
      forward.map((p) => p.polarAreaMoment),
    );
    expect(signedArea(reversed[0]!.domain)).toBeGreaterThan(0);
  });

  it("accepts a repeated closing vertex and collinear middle vertices", () => {
    const closed = [...square, { x: 0, y: 0 }];
    const padded = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const plain = splitConvex(square, seeds);
    expect(splitConvex(closed, seeds).map((p) => p.area)).toEqual(
      plain.map((p) => p.area),
    );
    expect(splitConvex(padded, seeds).map((p) => p.area)).toEqual(
      plain.map((p) => p.area),
    );
  });

  it("drops a cell vertex that is only rounding noise", () => {
    // The bisector of these two seeds runs through two parent vertices.
    const pieces = splitConvex(square, [
      { x: 1, y: 3 },
      { x: 3, y: 1 },
    ]);
    expect(pieces.map((p) => p.domain.length)).toEqual([3, 3]);
  });

  it("throws on invalid seeds", () => {
    expect(() => splitConvex(square, [])).toThrow("no seeds");
    expect(() => splitConvex(square, [seeds[0]!, seeds[0]!])).toThrow(
      "duplicate",
    );
    expect(() => splitConvex(square, [{ x: 5, y: 1 }])).toThrow(
      "strictly inside",
    );
    expect(() => splitConvex(square, [{ x: 2, y: 0 }])).toThrow(
      "strictly inside",
    );
    expect(() => splitConvex(square, [{ x: 0, y: 0 }])).toThrow(
      "strictly inside",
    );
    expect(() => splitConvex(square, [{ x: NaN, y: 1 }])).toThrow("non-finite");
    expect(() => splitConvex(square, [{ x: 1, y: Infinity }])).toThrow(
      "non-finite",
    );
  });

  it("throws on a cell with no area", () => {
    const tiny = 1e-7;
    expect(() =>
      splitConvex(square, [
        { x: tiny, y: tiny },
        { x: 3 * tiny, y: tiny },
        { x: tiny, y: 3 * tiny },
      ]),
    ).toThrow("no area");
  });

  it("throws on an invalid parent", () => {
    const one = [seeds[0]!];
    expect(() =>
      splitConvex(
        [
          { x: 0, y: 0 },
          { x: NaN, y: 1 },
          { x: 1, y: 1 },
        ],
        one,
      ),
    ).toThrow("non-finite");
    expect(() =>
      splitConvex(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        one,
      ),
    ).toThrow("repeated");
    expect(() =>
      splitConvex(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        one,
      ),
    ).toThrow("3 distinct");
    expect(() => splitConvex([], one)).toThrow("3 distinct");
    expect(() =>
      splitConvex(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
        one,
      ),
    ).toThrow("no area");
    expect(() =>
      splitConvex(
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 2, y: 1 },
          { x: 0, y: 4 },
        ],
        one,
      ),
    ).toThrow("not convex");
    const star = Array.from({ length: 5 }, (_, i) => {
      const angle = (4 * Math.PI * i) / 5;
      return { x: Math.cos(angle), y: Math.sin(angle) };
    });
    expect(() => splitConvex(star, [{ x: 0, y: 0 }])).toThrow(
      "self-intersecting",
    );
  });
});

describe("numeric boundary handling", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  it("accepts distinct interior seeds arbitrarily close to an edge or each other", () => {
    expect(splitConvex(square, [{ x: 1e-13, y: 0.5 }])[0]?.area).toBe(1);
    const pieces = splitConvex(square, [
      { x: 0.5, y: 0.5 },
      { x: 0.5 + 1e-13, y: 0.5 },
    ]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]!.area + pieces[1]!.area).toBeCloseTo(1, 14);
  });
  it("rejects shallow concavity instead of discarding it as collinearity", () => {
    expect(() =>
      splitConvex(
        [
          { x: 0, y: 0 },
          { x: 0.5, y: 1e-14 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        [{ x: 0.5, y: 0.5 }],
      ),
    ).toThrow();
  });
  it("retains interior predicates and distinct sites before coordinate translation", () => {
    expect(splitConvex(square, [{ x: 1e-17, y: 0.5 }])[0]?.area).toBe(1);
    expect(
      splitConvex(square, [
        { x: 1e-18, y: 0.25 },
        { x: 1e-18, y: 0.75 },
      ]).map((p) => p.area),
    ).toEqual([0.5, 0.5]);
    const shifted = square.map((p) => ({ x: p.x * 4 - 1, y: p.y * 4 - 1 }));
    expect(
      splitConvex(shifted, [
        { x: 0, y: 1 },
        { x: 1e-18, y: 1 },
      ]).map((p) => p.area),
    ).toEqual([4, 12]);
  });
  it("conserves momentum in an asymmetric polygon far from the origin", () => {
    const local = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 1 },
    ];
    const moments = polygonMoments(local);
    for (const count of [8, 16, 32]) {
      const shift = 1e8;
      const seeds = Array.from({ length: count }, (_, i) => ({
        x: shift + 0.25 + (i % 8) * 0.4,
        y: shift + 0.2 + Math.floor(i / 8) * 0.2,
      }));
      const pieces = splitConvex(
        local.map((p) => ({ x: p.x + shift, y: p.y + shift })),
        seeds,
      );
      const parent = {
        domain: local,
        area: moments.area,
        polarAreaMoment: moments.polarAreaMoment,
        v: { x: 1.7, y: -0.4 },
        omega: 2.9,
      };
      const children = pieces.map((p) => bodyOf(p, parent));
      const px = children.reduce((sum, b) => sum + b.area * b.v.x, 0);
      const py = children.reduce((sum, b) => sum + b.area * b.v.y, 0);
      const angular = pieces.reduce(
        (sum, p, i) =>
          sum +
          p.area *
            (p.centroidOffset.x * children[i]!.v.y -
              p.centroidOffset.y * children[i]!.v.x) +
          p.polarAreaMoment * parent.omega,
        0,
      );
      expect(
        Math.hypot(
          px - parent.area * parent.v.x,
          py - parent.area * parent.v.y,
        ) / Math.hypot(parent.area * parent.v.x, parent.area * parent.v.y),
      ).toBeLessThanOrEqual(BOUND);
      expect(
        Math.abs(angular - parent.polarAreaMoment * parent.omega) /
          (parent.polarAreaMoment * parent.omega),
      ).toBeLessThanOrEqual(BOUND);
    }
  });
  it("preserves a translated polygon's area", () => {
    const shift = 1e8;
    const pieces = splitConvex(
      square.map((p) => ({ x: p.x + shift, y: p.y + shift })),
      [
        { x: shift + 0.25, y: shift + 0.5 },
        { x: shift + 0.75, y: shift + 0.5 },
      ],
    );
    expect(pieces.map((p) => p.area)).toEqual([0.5, 0.5]);
  });
});
