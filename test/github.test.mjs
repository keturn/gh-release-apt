import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterDebAssets } from '../src/github.mjs';

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
