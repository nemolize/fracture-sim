import { polygonMoments } from "@/sim/polygon";

import type { BodyShape } from "./body";
import type { EnvironmentSettings } from "./environment";
import { fitObjectSize, MIN_OBJECT_SIZE, type ObjectSize } from "./object-size";

export const OBJECT_SHAPES = [
  "rectangle",
  "ellipse",
  "triangle",
  "hexagon",
] as const;
export type ObjectShape = (typeof OBJECT_SHAPES)[number];
export const asObjectShape = (value: string): ObjectShape | undefined =>
  OBJECT_SHAPES.find((shape) => shape === value);

const HEIGHT_PER_WIDTH: Record<ObjectShape, number> = {
  rectangle: 0.5,
  ellipse: 1,
  triangle: Math.sqrt(3) / 2,
  hexagon: Math.sqrt(3) / 2,
};

export const naturalObjectSize = (
  shape: ObjectShape,
  currentWidth: number,
  bounds: Pick<EnvironmentSettings, "width" | "height">,
): ObjectSize => {
  const ratio = HEIGHT_PER_WIDTH[shape];
  const width = Math.max(currentWidth, MIN_OBJECT_SIZE / ratio);
  return fitObjectSize({ width, height: width * ratio }, bounds);
};

export const objectPolygon = (
  shape: string,
  { width, height }: ObjectSize,
): BodyShape["polygon"] => {
  let points: BodyShape["polygon"];
  switch (shape) {
    case "rectangle":
      points = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ];
      break;
    case "ellipse":
      points = Array.from(
        { length: 32 },
        (_, index): readonly [number, number] => [
          Math.cos((index * 2 * Math.PI) / 32) / 2,
          Math.sin((index * 2 * Math.PI) / 32) / 2,
        ],
      );
      break;
    case "triangle":
      points = [
        [-0.5, 0],
        [0.5, 0],
        [0, 1],
      ];
      break;
    case "hexagon":
      points = [
        [-0.5, 0],
        [-0.25, -0.5],
        [0.25, -0.5],
        [0.5, 0],
        [0.25, 0.5],
        [-0.25, 0.5],
      ];
      break;
    default:
      throw new Error(`Unknown object shape: ${shape}`);
  }
  const scaled = points.map(([x, y]) => ({ x: x * width, y: y * height }));
  const { centroid } = polygonMoments(scaled);
  return scaled.map(({ x, y }): readonly [number, number] => [
    x - centroid.x,
    y - centroid.y,
  ]);
};
