import { atByte, atInt } from "./array";

/**
 * Labels each live triangle with the id of the connected piece it belongs to
 * (triangles sharing a node are connected), writes -1 for eroded ones, and
 * returns the number of pieces.
 */
export const labelChunks = (
  tri: Int32Array,
  alive: Uint8Array,
  nodeCount: number,
  labels: Int32Array,
): number => {
  const parent = new Int32Array(nodeCount).map((_, i) => i);
  const find = (node: number): number => {
    let root = node;
    while (atInt(parent, root) !== root) root = atInt(parent, root);
    let cursor = node;
    while (atInt(parent, cursor) !== root) {
      const next = atInt(parent, cursor);
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  };
  for (let e = 0; e < alive.length; e++) {
    if (atByte(alive, e) === 0) continue;
    const root = find(atInt(tri, 3 * e));
    for (let k = 1; k < 3; k++) {
      parent[find(atInt(tri, 3 * e + k))] = root;
    }
  }
  const ids = new Map<number, number>();
  for (let e = 0; e < alive.length; e++) {
    if (atByte(alive, e) === 0) {
      labels[e] = -1;
      continue;
    }
    const root = find(atInt(tri, 3 * e));
    let id = ids.get(root);
    if (id === undefined) {
      id = ids.size;
      ids.set(root, id);
    }
    labels[e] = id;
  }
  return ids.size;
};
