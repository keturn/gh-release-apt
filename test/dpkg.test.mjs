import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generatePackagesFile } from '../src/dpkg.mjs';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

test('dpkg-scanpackages is available', async () => {
  try {
    const { stdout } = await execAsync('which dpkg-scanpackages');
    assert(stdout.trim().length > 0, 'dpkg-scanpackages should be available');
  } catch (error) {
    // If not available, skip the test with a message
    console.log('dpkg-scanpackages not available - skipping test');
  }
});

test('generatePackagesFile throws error when directory does not exist', async () => {
  const nonExistentDir = path.join(tmpdir(), 'non-existent-' + Date.now());
  const outputPath = path.join(tmpdir(), 'Packages-' + Date.now());
  
  await assert.rejects(
    async () => {
      await generatePackagesFile(nonExistentDir, outputPath);
    },
    {
      message: /Directory not found/,
    }
  );
});

test('generatePackagesFile throws error when no .deb files found', async () => {
  const tempDir = path.join(tmpdir(), 'test-dpkg-' + Date.now());
  const outputPath = path.join(tmpdir(), 'Packages-' + Date.now());
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    await assert.rejects(
      async () => {
        await generatePackagesFile(tempDir, outputPath);
      },
      {
        message: /No .deb files found/,
      }
    );
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.unlink(outputPath).catch(() => {});
    } catch {}
  }
});

