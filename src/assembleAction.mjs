import fs from 'fs/promises';
import path from 'node:path';
import { $ as zx } from 'zx';
import { extractEntriesByArchitecture } from './repository.mjs';
import { fdir } from 'fdir';

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
    await zx`xz -k -f ${packagesPath}`;
  }

  console.log(`\n✓ Packages files assembled successfully!`);
  console.log(`  Created ${architectures.length} architecture-specific Packages file(s) in dists/stable/main/`);
}


/**
 * Recursively finds all files matching a name in a directory
 * @param {string} dir - Directory to search
 * @param {string} filename - Filename to search for
 * @returns {Promise<string[]>} Array of file paths
 */
export async function findFilesRecursive(dir, filename) {
    return (new fdir()
      .withFullPaths()
      .filter((filePath, isDirectory) => !isDirectory && path.basename(filePath) === filename)
      .crawl(dir)).withPromise();
}
  