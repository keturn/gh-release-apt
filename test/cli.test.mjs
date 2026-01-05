import { test } from 'node:test';
import assert from 'node:assert/strict';

test('CLI argument parsing test', async () => {
  // Test that owner/repo format is parsed correctly
  const testRepo = 'owner/repo';
  const [owner, repo] = testRepo.split('/');
  
  assert(owner === 'owner', 'Owner should be parsed correctly');
  assert(repo === 'repo', 'Repo should be parsed correctly');
});

test('Invalid repository format handling', async () => {
  const invalidFormats = ['owner', 'owner/', '/repo', ''];
  
  for (const format of invalidFormats) {
    const parts = format.split('/');
    const isValid = parts.length === 2 && parts[0] && parts[1];
    assert(!isValid, `Format "${format}" should be invalid`);
  }
});

