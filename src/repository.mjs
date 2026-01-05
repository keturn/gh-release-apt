import fs from 'fs/promises';
import path from 'path';

/**
 * Organizes .deb files into an APT repository structure
 * @param {string[]} debFiles - Array of paths to .deb files
 * @param {string} outputDir - Root directory for the APT repository
 * @returns {Promise<{debDir: string, packagesPath: string}>} Object with deb directory and Packages file path
 */
export async function organizeDebFiles(debFiles, outputDir) {
  // Create APT repository structure:
  // output/
  //   pool/
  //     main/
  //       *.deb files
  //   Packages

  const poolDir = path.join(outputDir, 'pool', 'main');
  await fs.mkdir(poolDir, { recursive: true });

  // Move or copy .deb files to pool/main/
  for (const debFile of debFiles) {
    const fileName = path.basename(debFile);
    const destPath = path.join(poolDir, fileName);

    // If file is already in the target location, skip
    if (debFile !== destPath) {
      try {
        await fs.copyFile(debFile, destPath);
      } catch (error) {
        throw new Error(`Failed to organize ${fileName}: ${error.message}`);
      }
    }
  }

  const packagesPath = path.join(outputDir, 'Packages');

  return {
    debDir: poolDir,
    packagesPath,
  };
}

