import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Generates a Packages file using dpkg-scanpackages
 * @param {string} debDir - Directory containing .deb files
 * @param {string} outputPath - Path where the Packages file should be written
 * @returns {Promise<void>}
 * @throws {Error} If dpkg-scanpackages fails or no .deb files are found
 */
export async function generatePackagesFile(debDir, outputPath) {
  // Check if directory exists and contains .deb files
  try {
    const files = await fs.readdir(debDir);
    const debFiles = files.filter((file) => file.endsWith('.deb'));

    if (debFiles.length === 0) {
      throw new Error(`No .deb files found in ${debDir}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Directory not found: ${debDir}`);
    }
    throw error;
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  try {
    // dpkg-scanpackages scans the directory and outputs to stdout
    // We redirect stdout to the Packages file
    // The command format: dpkg-scanpackages <directory> [override-file] > Packages
    const { stdout, stderr } = await execAsync(
      `dpkg-scanpackages "${debDir}" /dev/null > "${outputPath}"`
    );

    if (stderr && !stderr.includes('dpkg-scanpackages')) {
      // dpkg-scanpackages may write warnings to stderr, but that's usually fine
      console.warn('dpkg-scanpackages warnings:', stderr);
    }

    // Verify the Packages file was created
    try {
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Generated Packages file is empty');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Packages file was not created');
      }
      throw error;
    }
  } catch (error) {
    if (error.code === 'ENOENT' && error.message.includes('dpkg-scanpackages')) {
      throw new Error(
        'dpkg-scanpackages not found. Please install dpkg-dev package.'
      );
    }
    throw new Error(
      `Failed to generate Packages file: ${error.message}`
    );
  }
}

