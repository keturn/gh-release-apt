import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _makeReleaseContent } from '../src/assembleAction.mjs';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures', 'assembleAction');

// Pre-calculated SHA256 checksums and sizes for fixture files
const FIXTURE_CHECKSUMS = {
  'main/binary-amd64/Packages': {
    sha256: '3220cc0c5555c39bfb92792977a84cd287f7e135b99e869f3d0e03d18c8704d8',
    size: 139,
  },
  'main/binary-arm64/Packages': {
    sha256: '18bd88521982f7788fee705fbdf51d4e40445f1857de1fce427617ce7ff34eae',
    size: 145,
  },
};

test('_makeReleaseContent generates correct Release file content', async () => {
  const testDir = path.join(tmpdir(), 'test-release-' + Date.now());
  const distPath = path.join(testDir, 'dists', 'stable');
  
  try {
    // Copy fixtures to test directory
    const sourceDistPath = path.join(fixturesDir, 'dists', 'stable');
    await fs.cp(sourceDistPath, distPath, { recursive: true });
    
    // Generate Release content
    const architectures = ['amd64', 'arm64'];
    const releaseContent = await _makeReleaseContent(distPath, architectures);
    
    // Verify the content structure
    assert(releaseContent.includes('Suite: stable'), 'Should include Suite field');
    assert(releaseContent.includes('Architectures: amd64 arm64'), 'Should include Architectures field');
    assert(releaseContent.includes('Components: main'), 'Should include Components field');
    assert(releaseContent.includes('Date:'), 'Should include Date field');
    assert(releaseContent.includes('SHA256:'), 'Should include SHA256 header');
    
    // Verify SHA256 entries are present with expected values
    const amd64Checksum = FIXTURE_CHECKSUMS['main/binary-amd64/Packages'];
    const arm64Checksum = FIXTURE_CHECKSUMS['main/binary-arm64/Packages'];
    
    assert(
      releaseContent.includes(` ${amd64Checksum.sha256} ${amd64Checksum.size} main/binary-amd64/Packages`),
      'Should include SHA256 entry for amd64 Packages file'
    );
    assert(
      releaseContent.includes(` ${arm64Checksum.sha256} ${arm64Checksum.size} main/binary-arm64/Packages`),
      'Should include SHA256 entry for arm64 Packages file'
    );
    
  } finally {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  }
});
