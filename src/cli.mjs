import { Command } from 'commander';
import { getLatestRelease, downloadDebAssets } from './github.mjs';
import { organizeDebFiles } from './repository.mjs';
import { generatePackagesFile } from './dpkg.mjs';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';
import { fdir } from 'fdir';

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
  await generatePackagesFile(outputDir, packagesPath);

  console.log(`\n✓ APT repository created successfully!`);
  console.log(`  Output directory: ${outputDir}`);
  console.log(`  Packages file: ${packagesPath}`);
  console.log(`  .deb files: ${debDir}`);
}

/**
 * Recursively finds all files matching a name in a directory
 * @param {string} dir - Directory to search
 * @param {string} filename - Filename to search for
 * @returns {Promise<string[]>} Array of file paths
 */
async function findFilesRecursive(dir, filename) {
  return (new fdir()
    .withFullPaths()
    .filter((filePath, isDirectory) => !isDirectory && path.basename(filePath) === filename)
    .crawl(dir)).withPromise();
}

/**
 * Action handler for the assemble command
 * Concatenates all Packages files from pool/ subdirectories into a single Packages file
 * Uses streaming writes to avoid loading all content into memory at once
 * @param {Object} options - Command options
 * @param {string} [options.output] - Output directory
 */
export async function assembleAction(options) {
  const outputDir = path.resolve(options.output);
  const poolDir = path.join(outputDir, 'pool');
  const outputPackagesPath = path.join(outputDir, 'Packages');

  console.log(`Scanning for Packages files in ${poolDir}...`);

  // Find all Packages files in pool/ subdirectories
  const packagesFiles = await findFilesRecursive(poolDir, 'Packages');

  if (packagesFiles.length === 0) {
    throw new Error(`No Packages files found in ${poolDir}`);
  }

  console.log(`Found ${packagesFiles.length} Packages file(s)`);
  console.log(`Assembling into ${outputPackagesPath}...`);

  // Create write stream for output file
  const writeStream = createWriteStream(outputPackagesPath, { encoding: 'utf8' });

  try {
    // Process each Packages file and write to output stream
    for (let i = 0; i < packagesFiles.length; i++) {
      const packagesFile = packagesFiles[i];
      
      // Read file content and trim trailing whitespace
      const content = await fs.readFile(packagesFile, 'utf-8');
      const trimmed = content.trimEnd();
      
      if (trimmed) {
        // Write trimmed content to stream
        writeStream.write(trimmed);
      }
      
      // Add blank line separator between files (except after the last one)
      if (i < packagesFiles.length - 1) {
        writeStream.write('\n\n');
      } else {
        // Add final newline after the last file
        writeStream.write('\n');
      }
    }

    // Close the write stream
    writeStream.end();
    
    // Wait for the stream to finish writing
    await finished(writeStream);

    console.log(`\n✓ Packages file assembled successfully!`);
    console.log(`  Output file: ${outputPackagesPath}`);
    console.log(`  Combined ${packagesFiles.length} fragment(s)`);
  } catch (error) {
    writeStream.destroy();
    throw error;
  }
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
    .version('1.0.0');

  program
    .command('import')
    .description('Import .deb assets from a GitHub release into an APT repository')
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

  program
    .command('assemble')
    .description('Assemble all Packages fragments from pool/ subdirectories into a single Packages file')
    .option(
      '-o, --output <directory>',
      'Output directory for the APT repository',
      './apt-repo'
    )
    .action(assembleAction);

  return program;
}

