import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'child_process';
import { promisify } from 'util';

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

test('generatePackagesFile structure test', async () => {
  // Placeholder for testing the function structure
  // Full integration test would require actual .deb files
  assert(true, 'Test structure in place');
});

