import fs from 'fs/promises';
import crypto from 'node:crypto';
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
 * @param {boolean} [options.sign] - Sign the Release file
 */

export async function assembleAction(options) {
  const outputDir = path.resolve(options.output);
  const poolDir = path.join(outputDir, 'pool');

  const packagesFiles = await findFilesRecursive(poolDir, 'Packages');

  if (packagesFiles.length === 0) {
    throw new Error(`No Packages files found in ${poolDir}`);
  }

  console.log(`Found ${packagesFiles.length} Packages file(s)`);
  console.log(`Parsing and grouping entries by architecture...`);

  const entriesByArch = new Map();

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

  // Write Packages file for each architecture
  for (const [arch, entries] of entriesByArch.entries()) {
    const distPath = path.join(outputDir, 'dists', 'stable', 'main', `binary-${arch}`);
    const packagesPath = path.join(distPath, 'Packages');

    await fs.mkdir(distPath, { recursive: true });

    // Write all entries for this architecture
    const packagesContent = entries.join('\n\n') + '\n';
    await fs.writeFile(packagesPath, packagesContent, 'utf-8');

    console.log(`  Created ${packagesPath} (${entries.length} package(s))`);

    // Compress the Packages file to Packages.xz
    await zx`xz -k -f ${packagesPath}`;
  }

  console.log(`\n✓ Packages files assembled successfully!`);
  console.log(`  Created ${entriesByArch.size} architecture-specific Packages file(s) in dists/stable/main/`);

  await writeReleaseFile(outputDir, Array.from(entriesByArch.keys()), options.sign);
}


/**
 * Write the Release file.
 * @param {string} outputDir - Output directory
 * @param {string[]} architectures - Architectures
 * @param {boolean} sign - Sign the Release file
 * @returns {Promise<void>}
 */
export async function writeReleaseFile(outputDir, architectures, sign) {
  const distPath = path.join(outputDir, 'dists', 'stable');
  const releaseContent = await _makeReleaseContent(distPath, architectures);
  const releasePath = path.join(distPath, 'Release');

  await fs.writeFile(releasePath, releaseContent, 'utf-8');
  if (sign) {
    await signReleaseFile(distPath);
  }
}

/**
 * Make the Release file content.
 * @param {string} distPath - Distribution path
 * @param {string[]} architectures - Architectures
 * @returns {Promise<string>}
 */
async function _makeReleaseContent(distPath, architectures) {
    let releaseContent = `Suite: stable
Architectures: ${architectures.join(' ')}
Components: main
Date: ${new Date().toISOString()}
SHA256:
`;

    // List all Packages files with their size and SHA256 checksum
    const packagesFiles = await findFilesRecursive(distPath, 'Packages');
    for (const packagesFile of packagesFiles) {
        const stats = await fs.stat(packagesFile);
        const content = await fs.readFile(packagesFile, 'utf-8');
        const sha256 = crypto.createHash('sha256').update(content).digest('hex');
        releaseContent += ` ${sha256} ${stats.size} ${path.relative(distPath, packagesFile)}\n`;
    }
    return releaseContent;
}

/**
 * Sign the Release file.
 * 
 * Uses `sq` and assumes the SIGNING_KEY environment variable is set.
 * @param {string} distPath - Distribution path
 * @returns {Promise<void>}
 */
export async function signReleaseFile(distPath) {
  const releasePath = path.join(distPath, 'Release');
  await zx`sq sign --signer-file <(printenv SIGNING_KEY) --signature-file ${releasePath}.gpg ${releasePath}`;
  await zx`sq sign --signer-file <(printenv SIGNING_KEY) --cleartext --output ${path.join(distPath, 'InRelease')} ${releasePath}`;
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
  