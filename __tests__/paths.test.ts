import path from 'path';
import { getRootDir, getPublicDir, getDistPublicDir } from '../paths';

describe('paths utilities', () => {
  test('getRootDir returns input when not in dist', () => {
    const dir = path.resolve('/tmp/project');
    expect(getRootDir(dir)).toBe(dir);
  });

  test('getRootDir resolves parent when in dist', () => {
    const distDir = path.resolve('/tmp/project/dist');
    expect(path.basename(getRootDir(distDir))).toBe('project');
  });

  test('getPublicDir joins root with public', () => {
    const root = path.resolve('/tmp/project');
    expect(getPublicDir(root)).toBe(path.join(root, 'public'));
  });

  test('getDistPublicDir joins root with dist-public', () => {
    const root = path.resolve('/tmp/project');
    expect(getDistPublicDir(root)).toBe(path.join(root, 'dist-public'));
  });
});


