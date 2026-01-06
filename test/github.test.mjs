import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { filterDebAssets, downloadDebAssets, downloadFile } from '../src/github.mjs';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

test('filterDebAssets filters .deb files correctly', () => {
  const mockRelease = {
    tag_name: 'v1.0.0',
    assets: [
      { name: 'package.deb', browser_download_url: 'https://github.example/example/someone/releases/download/v1.0.0/package.deb' },
      { name: 'readme.txt', browser_download_url: 'https://github.example/example/someone/releases/download/v1.0.0/readme.txt' },
      { name: 'another.deb', browser_download_url: 'https://github.example/example/someone/releases/download/v1.0.0/another.deb' },
    ],
  };

  const debAssets = filterDebAssets(mockRelease);
  
  // Verify that only .deb files are returned
  assert.equal(debAssets.length, 2, 'Should filter to 2 .deb files');
  assert.equal(debAssets[0].name, 'package.deb');
  assert.equal(debAssets[1].name, 'another.deb');
  
  // Verify the assets have the correct structure
  assert.equal(debAssets[0].browser_download_url, 'https://github.example/example/someone/releases/download/v1.0.0/package.deb');
  assert.equal(debAssets[1].browser_download_url, 'https://github.example/example/someone/releases/download/v1.0.0/another.deb');
});

test('filterDebAssets returns empty array when no .deb assets', () => {
  const mockRelease = {
    tag_name: 'v1.0.0',
    assets: [
      { name: 'readme.txt', browser_download_url: 'https://github.example/example/someone/releases/download/v1.0.0/readme.txt' },
    ],
  };

  const debAssets = filterDebAssets(mockRelease);
  assert.equal(debAssets.length, 0, 'Should return empty array when no .deb assets');
});

test('downloadDebAssets skips download when checksum matches', async () => {
  // Based on real GitHub API response structure from cli/cli
  const mockRelease = {
    tag_name: 'v2.83.2',
    assets: [
      {
        name: 'gh_2.83.2_linux_386.deb',
        browser_download_url: 'https://github.com/cli/cli/releases/download/v2.83.2/gh_2.83.2_linux_386.deb',
        digest: 'sha256:10ee826b440b68c3e19f004d330116a9173e2f96052afa3a98e67f6af948c676',
        size: 17737928,
        content_type: 'application/x-debian-package',
        state: 'uploaded',
      },
    ],
  };

  const outputDir = path.join(tmpdir(), 'test-download-' + Date.now());
  const owner = 'cli';
  const repo = 'cli';
  
  try {
    // Create Packages file with matching checksum
    const packagesDir = path.join(outputDir, 'pool', owner, repo, mockRelease.tag_name);
    await fs.mkdir(packagesDir, { recursive: true });
    const packagesPath = path.join(packagesDir, 'Packages');
    
    const packagesContent = `Package: gh
Version: 2.83.2-1
Architecture: i386
Filename: ./pool/cli/cli/v2.83.2/gh_2.83.2_linux_386.deb
Size: 17737928
SHA256: 10ee826b440b68c3e19f004d330116a9173e2f96052afa3a98e67f6af948c676
`;
    await fs.writeFile(packagesPath, packagesContent);
    
    // Create the file on disk (simulating it already exists)
    const filePath = path.join(packagesDir, 'gh_2.83.2_linux_386.deb');
    await fs.writeFile(filePath, 'fake deb content');
    
    // Mock downloadFile to prevent actual download
    const downloadFileMock = mock.fn(async () => {});
    
    // Pass the mock as the downloadFn parameter
    const downloadedFiles = await downloadDebAssets(mockRelease, owner, repo, outputDir, undefined, downloadFileMock);
    
    // Should have skipped download
    assert.equal(downloadFileMock.mock.calls.length, 0, 'Should not have called downloadFile');
    assert.equal(downloadedFiles.length, 1, 'Should return file path even when skipped');
    assert.equal(downloadedFiles[0], filePath, 'Should return existing file path');
  } finally {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {}
  }
});
