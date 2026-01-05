#!/usr/bin/env node

import { Command } from 'commander';
import { getLatestRelease, downloadDebAssets } from '../src/github.mjs';
import { organizeDebFiles } from '../src/repository.mjs';
import { generatePackagesFile } from '../src/dpkg.mjs';
import path from 'path';
import fs from 'fs/promises';

const program = new Command();

program
  .name('gh-release-apt')
  .description('Generate APT repositories from GitHub release .deb assets')
  .version('1.0.0')
  .argument('<owner/repo>', 'GitHub repository in owner/repo format')
  .option(
    '-o, --output <directory>',
    'Output directory for the APT repository',
    './apt-repo'
  )
  .option(
    '-t, --token <token>',
    'GitHub token for authentication (or use GITHUB_TOKEN env var)'
  )
  .action(async (repoIdentifier, options) => {
    try {
      // Parse owner/repo
      const [owner, repo] = repoIdentifier.split('/');
      if (!owner || !repo) {
        console.error('Error: Invalid repository format. Use owner/repo');
        process.exit(1);
      }

      const outputDir = path.resolve(options.output);
      const token = options.token || process.env.GITHUB_TOKEN;

      console.log(`Fetching latest release for ${owner}/${repo}...`);
      const release = await getLatestRelease(owner, repo, token);

      console.log(`Found release: ${release.tag_name}`);
      console.log(`Downloading .deb assets...`);

      // Create temporary directory for initial downloads
      const tempDir = path.join(outputDir, '.temp');
      const debFiles = await downloadDebAssets(release, tempDir, token);

      console.log(`Downloaded ${debFiles.length} .deb file(s)`);
      console.log(`Organizing files into APT repository structure...`);

      const { debDir, packagesPath } = await organizeDebFiles(debFiles, outputDir);

      console.log(`Generating Packages file...`);
      await generatePackagesFile(debDir, packagesPath);

      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }

      console.log(`\n✓ APT repository created successfully!`);
      console.log(`  Output directory: ${outputDir}`);
      console.log(`  Packages file: ${packagesPath}`);
      console.log(`  .deb files: ${debDir}`);
    } catch (error) {
      console.error(`\n✗ Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();

