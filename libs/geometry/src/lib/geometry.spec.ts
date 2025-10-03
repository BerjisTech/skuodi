import { buildWallMeshes, WallSegment } from './geometry';

describe('geometry utilities', () => {
  it('generates triangulated meshes for simple walls', () => {
    const segments: WallSegment[] = [
      {
        start: [0, 0],
        end: [4, 0],
        thickness: 0.2,
        height: 3,
      },
    ];
    const meshes = buildWallMeshes(segments);
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes[0].positions.length).toBeGreaterThan(0);
    expect(meshes[0].indices.length).toBeGreaterThan(0);
  });
});
