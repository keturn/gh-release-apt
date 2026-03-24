#!/usr/bin/env node

import { createCommand } from '../src/cli.mjs';

const program = createCommand();

(async () => {
  try {
    await program.parseAsync();
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    process.exit(1);
  }
})();

