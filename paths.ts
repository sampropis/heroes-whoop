import path from 'path';

export function getRootDir(fromDir: string): string {
  return path.basename(fromDir) === 'dist' ? path.resolve(fromDir, '..') : fromDir;
}

export function getPublicDir(fromDir: string): string {
  return path.join(getRootDir(fromDir), 'public');
}

export function getDistPublicDir(fromDir: string): string {
  return path.join(getRootDir(fromDir), 'dist-public');
}



