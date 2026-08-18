export interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

export interface HexGridCoord {
  index: number;
  cube: CubeCoord;
  baseX: number;
  baseY: number;
}

export const toCubeKey = (cube: CubeCoord): string => `${cube.x}:${cube.y}:${cube.z}`;

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

export const roundCube = (cube: CubeCoord): CubeCoord => {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: normalizeZero(rx), y: normalizeZero(ry), z: normalizeZero(rz) };
};

export const pixelToCubeCenter = (
  worldX: number,
  worldY: number,
  spacingX: number,
  spacingY: number,
): CubeCoord => {
  const z = worldY / spacingY;
  const x = (worldX - (z * spacingX) / 2) / spacingX;
  const y = -x - z;
  return roundCube({ x, y, z });
};

export const forEachCubeInRadius = (
  center: CubeCoord,
  radius: number,
  callback: (cube: CubeCoord) => void,
): void => {
  const safeRadius = Math.max(0, Math.floor(radius));
  for (let dx = -safeRadius; dx <= safeRadius; dx++) {
    const minDy = Math.max(-safeRadius, -dx - safeRadius);
    const maxDy = Math.min(safeRadius, -dx + safeRadius);
    for (let dy = minDy; dy <= maxDy; dy++) {
      const dz = -dx - dy;
      callback({
        x: center.x + dx,
        y: center.y + dy,
        z: center.z + dz,
      });
    }
  }
};

const HEX_DIRS = [
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
];

export const getHexCubicAtIndex = (index: number): CubeCoord => {
  if (index <= 0) return { x: 0, y: 0, z: 0 };

  let radius = 1;
  while (index >= 1 + 3 * radius * (radius + 1)) radius += 1;

  const ringStart = 1 + 3 * (radius - 1) * radius;
  const ringOffset = index - ringStart;
  const side = Math.floor(ringOffset / radius);
  const stepsOnSide = (ringOffset % radius) + 1;
  const cube = { x: radius, y: -radius, z: 0 };

  for (let completedSide = 0; completedSide < side; completedSide++) {
    cube.x += HEX_DIRS[completedSide].x * radius;
    cube.y += HEX_DIRS[completedSide].y * radius;
    cube.z += HEX_DIRS[completedSide].z * radius;
  }
  cube.x += HEX_DIRS[side].x * stepsOnSide;
  cube.y += HEX_DIRS[side].y * stepsOnSide;
  cube.z += HEX_DIRS[side].z * stepsOnSide;
  return cube;
};

export const resizeHexGridCoords = (
  previous: readonly HexGridCoord[],
  count: number,
  spacingX: number,
  spacingY: number,
): HexGridCoord[] => {
  const safeCount = Math.max(0, count);
  const spacingMatches = previous.length === 0 || previous.every((coord) => (
    coord.baseX === coord.cube.x * spacingX + (coord.cube.z * spacingX) / 2
    && coord.baseY === coord.cube.z * spacingY
  ));
  const prefix = spacingMatches ? previous.slice(0, safeCount) : [];

  for (let index = prefix.length; index < safeCount; index++) {
    const cube = getHexCubicAtIndex(index);
    prefix.push({
      index,
      cube,
      baseX: cube.x * spacingX + (cube.z * spacingX) / 2,
      baseY: cube.z * spacingY,
    });
  }
  return prefix;
};

export const resolveVisibleHexIndexes = (
  center: CubeCoord,
  ringRadius: number,
  coordByKey: Map<string, number>,
  coords: HexGridCoord[],
  worldX: number,
  worldY: number,
  pixelRadius: number,
): number[] => {
  const radiusSq = pixelRadius * pixelRadius;
  const indexes: number[] = [];

  forEachCubeInRadius(center, ringRadius, (cube) => {
    const index = coordByKey.get(toCubeKey(cube));
    if (index === undefined) return;
    const coord = coords[index];
    if (!coord) return;
    const dx = coord.baseX - worldX;
    const dy = coord.baseY - worldY;
    if (dx * dx + dy * dy <= radiusSq) indexes.push(index);
  });

  indexes.sort((a, b) => a - b);
  return indexes;
};

export const areIndexListsEqual = (left: readonly number[], right: readonly number[]): boolean => {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
};
