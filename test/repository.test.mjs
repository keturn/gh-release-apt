import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organizeDebFiles } from '../src/repository.mjs';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

test('organizeDebFiles creates correct directory structure', async () => {
  const outputDir = path.join(tmpdir(), 'test-repo-' + Date.now());
  const tempDebDir = path.join(outputDir, '.temp');
  
  try {
    // Create temporary .deb files for testing
    await fs.mkdir(tempDebDir, { recursive: true });
    const debFile1 = path.join(tempDebDir, 'package1.deb');
    const debFile2 = path.join(tempDebDir, 'package2.deb');
    
    // Create empty files to simulate .deb files
    await fs.writeFile(debFile1, 'fake deb content');
    await fs.writeFile(debFile2, 'fake deb content');
    
    const result = await organizeDebFiles([debFile1, debFile2], outputDir);
    
    // Verify structure was created
    assert.equal(result.debDir, path.join(outputDir, 'pool', 'main'));
    assert.equal(result.packagesPath, path.join(outputDir, 'Packages'));
    
    // Verify files were copied
    const poolDir = result.debDir;
    const files = await fs.readdir(poolDir);
    assert.equal(files.length, 2);
    assert(files.includes('package1.deb'));
    assert(files.includes('package2.deb'));
  } finally {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {}
  }
});

test('organizeDebFiles handles empty array', async () => {
  const outputDir = path.join(tmpdir(), 'test-repo-empty-' + Date.now());
  
  try {
    const result = await organizeDebFiles([], outputDir);
    
    // Should still create the structure
    assert.equal(result.debDir, path.join(outputDir, 'pool', 'main'));
    assert.equal(result.packagesPath, path.join(outputDir, 'Packages'));
    
    // Directory should exist
    const stats = await fs.stat(result.debDir);
    assert(stats.isDirectory());
  } finally {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {}
  }
});

