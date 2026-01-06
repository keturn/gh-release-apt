import { Command } from 'commander';
import { getLatestRelease, downloadDebAssets } from './github.mjs';
import { organizeDebFiles } from './repository.mjs';
import { generatePackagesFile } from './dpkg.mjs';
import path from 'path';
import fs from 'fs/promises';

/**
 * Validates and parses the repository identifier format
 * Used as argParser for Commander.js argument validation
 * @param {string} repoIdentifier - Repository in owner/repo format
 * @returns {{owner: string, repo: string}} Parsed owner and repo
 * @throws {Error} If format is invalid
 */
export function parseRepository(repoIdentifier) {
  const parts = repoIdentifier.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid repository format. Use owner/repo');
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Main action handler for the CLI command
 * @param {{owner: string, repo: string}} repository - Parsed repository object
 * @param {Object} options - Command options
 * @param {string} [options.output] - Output directory
 * @param {string} [options.token] - GitHub token
 */
export async function runAction(repository, options) {
  const { owner, repo } = repository;

  const outputDir = path.resolve(options.output);
  const token = options.token || process.env.GITHUB_TOKEN;

  console.log(`Fetching latest release for ${owner}/${repo}...`);
  const release = await getLatestRelease(owner, repo, token);

  console.log(`Found release: ${release.tag_name}`);
  console.log(`Downloading .deb assets...`);

  // Download directly to pool/{owner}/{repo}/{tag_name}/ structure
  const debFiles = await downloadDebAssets(release, owner, repo, outputDir, token);

  console.log(`Downloaded ${debFiles.length} .deb file(s)`);
  console.log(`Organizing files into APT repository structure...`);

  const { debDir, packagesPath } = await organizeDebFiles(debFiles, owner, repo, release.tag_name, outputDir);

  console.log(`Generating Packages file...`);
  await generatePackagesFile(debDir, packagesPath);

  console.log(`\n✓ APT repository created successfully!`);
  console.log(`  Output directory: ${outputDir}`);
  console.log(`  Packages file: ${packagesPath}`);
  console.log(`  .deb files: ${debDir}`);
}

/**
 * Creates and configures the Commander.js command
 * @returns {Command} Configured command instance
 */
export function createCommand() {
  const program = new Command();

  program
    .name('gh-release-apt')
    .description('Generate APT repositories from GitHub release .deb assets')
    .version('1.0.0')
    .argument('<owner/repo>', 'GitHub repository in owner/repo format', parseRepository)
    .option(
      '-o, --output <directory>',
      'Output directory for the APT repository',
      './apt-repo'
    )
    .option(
      '-t, --token <token>',
      'GitHub token for authentication (or use GITHUB_TOKEN env var)'
    )
    .action(runAction);

  return program;
}

