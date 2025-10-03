/// <reference path="../types/clipper-lib.d.ts" />
import * as ClipperLib from 'clipper-lib';
import earcut from 'earcut';

export type Vec2 = [number, number];

export interface WallSegment {
  start: Vec2;
  end: Vec2;
  thickness: number; // meters
  height: number; // meters
}

export interface Opening {
  wallIndex: number;
  offset: number; // meters from start along centerline
  width: number; // meters
  height: number; // meters
  sill: number; // meters from floor
}

export interface TriangulatedMesh {
  positions: number[];
  indices: number[];
}

const SCALE = 10_000;

const normalise = (v: Vec2): Vec2 => {
  const length = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / length, v[1] / length];
};

const perpendicular = (v: Vec2): Vec2 => [-v[1], v[0]];

export function wallsToPolygons(segments: WallSegment[]): Vec2[][] {
  return segments.map((segment) => {
    const dir: Vec2 = [segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]];
    const unit = normalise(dir);
    const normal = perpendicular(unit);
    const half = segment.thickness / 2;

    const a: Vec2 = [segment.start[0] + normal[0] * half, segment.start[1] + normal[1] * half];
    const b: Vec2 = [segment.end[0] + normal[0] * half, segment.end[1] + normal[1] * half];
    const c: Vec2 = [segment.end[0] - normal[0] * half, segment.end[1] - normal[1] * half];
    const d: Vec2 = [segment.start[0] - normal[0] * half, segment.start[1] - normal[1] * half];

    return [a, b, c, d];
  });
}

export function unionPolygons(polygons: Vec2[][]): Vec2[][] {
  const clipper = new ClipperLib.Clipper();
  const subject = polygons.map((poly) =>
    poly.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }))
  );
  clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);

  const solution = new ClipperLib.Paths();
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return solution.map((path: ClipperLib.Path) =>
    path.map((point: ClipperLib.IntPoint) => [point.X / SCALE, point.Y / SCALE] as Vec2)
  );
}

export function triangulatePolygon(polygon: Vec2[]): TriangulatedMesh {
  const flat: number[] = [];
  polygon.forEach(([x, y]) => flat.push(x, y));
  const indices = earcut(flat);
  return { positions: flat, indices: Array.from(indices) };
}

export function subtractOpenings(polygons: Vec2[][], openings: Opening[], segments: WallSegment[]): Vec2[][] {
  if (!openings.length) {
    return polygons;
  }
  const clipper = new ClipperLib.Clipper();
  const subject = polygons.map((poly) =>
    poly.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }))
  );
  clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);

  const holes: ClipperLib.Path[] = openings.map((opening) => {
    const wall = segments[opening.wallIndex];
    const dir = normalise([wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]]);
    const normal = perpendicular(dir);
    const center: Vec2 = [
      wall.start[0] + dir[0] * opening.offset,
      wall.start[1] + dir[1] * opening.offset,
    ];
    const halfWidth = opening.width / 2;
    const halfThickness = wall.thickness / 2;
    const a: Vec2 = [center[0] - dir[0] * halfWidth + normal[0] * halfThickness, center[1] - dir[1] * halfWidth + normal[1] * halfThickness];
    const b: Vec2 = [center[0] + dir[0] * halfWidth + normal[0] * halfThickness, center[1] + dir[1] * halfWidth + normal[1] * halfThickness];
    const c: Vec2 = [center[0] + dir[0] * halfWidth - normal[0] * halfThickness, center[1] + dir[1] * halfWidth - normal[1] * halfThickness];
    const d: Vec2 = [center[0] - dir[0] * halfWidth - normal[0] * halfThickness, center[1] - dir[1] * halfWidth - normal[1] * halfThickness];
    return [a, b, c, d].map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
  });

  clipper.AddPaths(holes, ClipperLib.PolyType.ptClip, true);

  const solution = new ClipperLib.Paths();
  clipper.Execute(
    ClipperLib.ClipType.ctDifference,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return solution.map((path: ClipperLib.Path) =>
    path.map((point: ClipperLib.IntPoint) => [point.X / SCALE, point.Y / SCALE] as Vec2)
  );
}

export function buildWallMeshes(
  segments: WallSegment[],
  openings: Opening[] = []
): TriangulatedMesh[] {
  const basePolygons = wallsToPolygons(segments);
  const united = unionPolygons(basePolygons);
  const carved = subtractOpenings(united, openings, segments);
  return carved.map(triangulatePolygon);
}
