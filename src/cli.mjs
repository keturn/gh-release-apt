import { Command } from 'commander';
import { getLatestRelease, downloadDebAssets } from './github.mjs';
import { organizeDebFiles, extractEntriesByArchitecture } from './repository.mjs';
import { generatePackagesFile } from './dpkg.mjs';
import path from 'path';
import fs from 'fs/promises';
import { fdir } from 'fdir';
import { $ as zx } from 'zx';

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
 * Parses all Packages files from pool/ subdirectories, groups entries by Architecture,
 * and writes separate Packages files to dists/stable/main/binary-${arch}/Packages for each architecture
 * @param {Object} options - Command options
 * @param {string} [options.output] - Output directory
 */
export async function assembleAction(options) {
  const outputDir = path.resolve(options.output);
  const poolDir = path.join(outputDir, 'pool');

  console.log(`Scanning for Packages files in ${poolDir}...`);

  // Find all Packages files in pool/ subdirectories
  const packagesFiles = await findFilesRecursive(poolDir, 'Packages');

  if (packagesFiles.length === 0) {
    throw new Error(`No Packages files found in ${poolDir}`);
  }

  console.log(`Found ${packagesFiles.length} Packages file(s)`);
  console.log(`Parsing and grouping entries by architecture...`);

  // Group entries by architecture
  const entriesByArch = new Map();

  // Process each Packages file
  for (const packagesFile of packagesFiles) {
    const content = await fs.readFile(packagesFile, 'utf-8');
    const entries = extractEntriesByArchitecture(content);
    
    for (const { architecture, entry } of entries) {
      if (!entriesByArch.has(architecture)) {
        entriesByArch.set(architecture, []);
      }
      entriesByArch.get(architecture).push(entry);
    }
  }

  if (entriesByArch.size === 0) {
    throw new Error('No package entries with Architecture field found');
  }

  console.log(`Found ${entriesByArch.size} architecture(s): ${Array.from(entriesByArch.keys()).sort().join(', ')}`);

  // Sort architectures alphabetically for consistent output
  const architectures = Array.from(entriesByArch.keys()).sort();

  // Write Packages file for each architecture
  for (const arch of architectures) {
    const distPath = path.join(outputDir, 'dists', 'stable', 'main', `binary-${arch}`);
    const packagesPath = path.join(distPath, 'Packages');
    
    // Ensure directory exists
    await fs.mkdir(distPath, { recursive: true });
    
    // Write all entries for this architecture
    const entries = entriesByArch.get(arch);
    const packagesContent = entries.join('\n\n') + '\n';
    await fs.writeFile(packagesPath, packagesContent, 'utf-8');
    
    console.log(`  Created ${packagesPath} (${entries.length} package(s))`);
    
    // Compress the Packages file to Packages.xz
    const packagesXzPath = path.join(distPath, 'Packages.xz');
    try {
      await zx`xz -k -f ${packagesPath}`;
      // xz creates Packages.xz in the same directory as the input file
      // Verify the compressed file was created
      const stats = await fs.stat(packagesXzPath);
      if (stats.size === 0) {
        throw new Error('Generated Packages.xz file is empty');
      }
      console.log(`  Compressed to ${packagesXzPath}`);
    } catch (error) {
      if (error.code === 'ENOENT' || (error.stderr && error.stderr.includes('xz: not found'))) {
        throw new Error(
          'xz not found. Please install xz-utils package.'
        );
      }
      throw new Error(
        `Failed to compress Packages file for ${arch}: ${error.message || error.stderr || 'Unknown error'}`
      );
    }
  }

  console.log(`\n✓ Packages files assembled successfully!`);
  console.log(`  Created ${architectures.length} architecture-specific Packages file(s) in dists/stable/main/`);
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
    .description('Assemble all Packages fragments from pool/ subdirectories, grouped by architecture into dists/stable/main/binary-${arch}/Packages')
    .option(
      '-o, --output <directory>',
      'Output directory for the APT repository',
      './apt-repo'
    )
    .action(assembleAction);

  return program;
}

