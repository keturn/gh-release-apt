import fs from 'fs/promises';
import path from 'path';

/**
 * Organizes .deb files into an APT repository structure
 * Files are already in the correct location: pool/{owner}/{repo}/{tag_name}/
 * This function just returns the appropriate paths for Packages file generation
 * @param {string[]} debFiles - Array of paths to .deb files (already in correct location)
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} tagName - Release tag name
 * @param {string} outputDir - Root directory for the APT repository
 * @returns {Promise<{debDir: string, packagesPath: string}>} Object with deb directory and Packages file path
 */
export async function organizeDebFiles(debFiles, owner, repo, tagName, outputDir) {
  // Files are already in the correct structure:
  // output/
  //   pool/
  //     {owner}/
  //       {repo}/
  //         {tagName}/
  //           *.deb files
  //   Packages

  // The debDir is where the files are already located
  // Since all files are in the same directory, we can use the directory of the first file
  const debDir = debFiles.length > 0 
    ? path.dirname(debFiles[0])
    : path.join(outputDir, 'pool', owner, repo, tagName);

  // Ensure the directory exists (in case there are no files)
  await fs.mkdir(debDir, { recursive: true });

  const packagesPath = path.join(debDir, 'Packages');

  return {
    debDir,
    packagesPath,
  };
}

