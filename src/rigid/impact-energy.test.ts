import { expect, it } from "vitest";

import { contactMotion, impactEnergy } from "./impact-energy";

const fixed = { before: 0, after: 0, inverseMass: 0 };

it("assigns zero impact energy to stationary support and separating contacts", () => {
  expect(
    impactEnergy(fixed, { before: 0, after: 0, inverseMass: 0.02 }),
  ).toEqual([0, 0]);
  expect(impactEnergy({ before: -1, after: 0, inverseMass: 1 }, fixed)).toEqual(
    [0, 0],
  );
  expect(impactEnergy({ before: 1, after: 0, inverseMass: 0 }, fixed)).toEqual([
    0, 0,
  ]);
});

it("recovers 1/2 m v² for an inelastic hit against a fixed wall", () => {
  expect(
    impactEnergy({ before: 3, after: 0, inverseMass: 1 / 2 }, fixed),
  ).toEqual([9, 0]);
});

it("partitions unequal-mass collision energy without duplicating it", () => {
  const shares = impactEnergy(
    { before: 3, after: 0, inverseMass: 1 / 2 },
    { before: -1, after: 0, inverseMass: 1 / 6 },
  );
  expect(shares[0]).toBeCloseTo(9);
  expect(shares[1]).toBeCloseTo(3);
  expect(shares[0] + shares[1]).toBeCloseTo(12);
  const reversed = impactEnergy(
    { before: 1, after: 0, inverseMass: 1 / 6 },
    { before: -3, after: 0, inverseMass: 1 / 2 },
  );
  expect(reversed[0]).toBeCloseTo(3);
  expect(reversed[1]).toBeCloseTo(9);
});

it("is invariant under common translational velocity", () => {
  expect(
    impactEnergy(
      { before: 103, after: 100, inverseMass: 1 / 2 },
      { before: 99, after: 100, inverseMass: 1 / 6 },
    ),
  ).toEqual(
    impactEnergy(
      { before: 3, after: 0, inverseMass: 1 / 2 },
      { before: -1, after: 0, inverseMass: 1 / 6 },
    ),
  );
});

it("counts only normal-mode kinetic energy lost, including restitution", () => {
  expect(
    impactEnergy(
      { before: 1, after: -1, inverseMass: 1 },
      { before: -1, after: 1, inverseMass: 1 },
    ),
  ).toEqual([0, 0]);
  expect(
    impactEnergy(
      { before: 1, after: -0.5, inverseMass: 1 },
      { before: -1, after: 0.5, inverseMass: 1 },
    ),
  ).toEqual([0.375, 0.375]);
  expect(
    impactEnergy(
      { before: 1, after: -2, inverseMass: 1 },
      { before: -1, after: 2, inverseMass: 1 },
    ),
  ).toEqual([0, 0]);
});

it("includes angular contact velocity and inertia about the contact point", () => {
  const contact = contactMotion(
    { velocity: { x: 0, y: 0 }, angularVelocity: 3 },
    { velocity: { x: 0, y: 0 }, angularVelocity: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    0.5,
    2,
  );
  expect(contact).toEqual({ before: 3, after: 0, inverseMass: 2.5 });
  expect(impactEnergy(contact, fixed)).toEqual([1.8, 0]);
});
