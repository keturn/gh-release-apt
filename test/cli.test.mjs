import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepository, createCommand } from '../src/cli.mjs';

test('parseRepository parses valid owner/repo format', () => {
  const result = parseRepository('owner/repo');
  assert.equal(result.owner, 'owner');
  assert.equal(result.repo, 'repo');
});

test('parseRepository throws error for invalid formats', () => {
  const invalidFormats = ['owner', 'owner/', '/repo', '', 'owner/repo/extra'];
  
  for (const format of invalidFormats) {
    assert.throws(
      () => parseRepository(format),
      {
        message: /Invalid repository format/,
      },
      `Format "${format}" should throw error`
    );
  }
});

test('createCommand uses argParser to validate repository format', () => {
  const program = createCommand();
  const importCommand = program.commands.find(cmd => cmd.name() === 'import');
  assert(importCommand, 'import subcommand should exist');

  const arg = importCommand.registeredArguments.find(arg => arg.name() === 'owner/repo');
  assert(arg, 'owner/repo argument should exist on import subcommand');

  const result = arg.parseArg('someone/example');
  assert.equal(result.owner, 'someone');
  assert.equal(result.repo, 'example');
});

