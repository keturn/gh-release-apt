import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organizeDebFiles } from '../src/repository.mjs';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

test('organizeDebFiles returns correct paths for new directory structure', async () => {
  const outputDir = path.join(tmpdir(), 'test-repo-' + Date.now());
  const owner = 'foo';
  const repo = 'bar';
  const tagName = 'v1.0.0';
  
  // Create .deb files in the new structure: pool/{owner}/{repo}/{tagName}/
  const debDir = path.join(outputDir, 'pool', owner, repo, tagName);
  await fs.mkdir(debDir, { recursive: true });
  const debFile1 = path.join(debDir, 'package1.deb');
  const debFile2 = path.join(debDir, 'package2.deb');
  
  // Create empty files to simulate .deb files
  await fs.writeFile(debFile1, 'fake deb content');
  await fs.writeFile(debFile2, 'fake deb content');
  
  const result = await organizeDebFiles([debFile1, debFile2], owner, repo, tagName, outputDir);
  
  // Verify structure paths are correct
  assert.equal(result.debDir, debDir);
  assert.equal(result.packagesPath, path.join(debDir, 'Packages'));
  
  // Verify files are in the correct location
  const files = await fs.readdir(debDir);
  assert.equal(files.length, 2);
  assert(files.includes('package1.deb'));
  assert(files.includes('package2.deb'));
  
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch {}
});

test('organizeDebFiles handles empty array', async () => {
  const outputDir = path.join(tmpdir(), 'test-repo-empty-' + Date.now());
  const owner = 'foo';
  const repo = 'bar';
  const tagName = 'v1.0.0';
  
  try {
    const result = await organizeDebFiles([], owner, repo, tagName, outputDir);
    
    // Should still create the structure
    assert.equal(result.debDir, path.join(outputDir, 'pool', owner, repo, tagName));
    
    // Directory should exist
    const stats = await fs.stat(result.debDir);
    assert(stats.isDirectory());
  } finally {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {}
  }
});

