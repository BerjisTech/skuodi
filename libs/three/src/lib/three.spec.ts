import { createScene } from './three';

describe('three scene helpers', () => {
  it('creates a scene bundle', () => {
    const canvas = document.createElement('canvas');
    const bundle = createScene(canvas);
    expect(bundle.scene).toBeDefined();
    expect(bundle.renderer.domElement).toBe(canvas);
  });
});
