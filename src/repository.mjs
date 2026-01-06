import fs from 'fs/promises';
import path from 'path';

/**
 * Parses an existing Packages file and extracts filename to SHA256 checksum mappings
 * @param {string} packagesPath - Path to the Packages file
 * @returns {Promise<Map<string, string>>} Map of filename (basename) to SHA256 checksum
 */
export async function parsePackagesFile(packagesPath) {
  const checksumMap = new Map();

  try {
    const content = await fs.readFile(packagesPath, 'utf-8');
    
    // Split by blank lines to get individual package entries
    const entries = content.split(/\n\s*\n/).filter(entry => entry.trim());
    
    for (const entry of entries) {
      let filename = null;
      let sha256 = null;
      
      // Parse each line in the entry
      for (const line of entry.split('\n')) {
        if (line.startsWith('Filename:')) {
          // Extract basename from path like ./pool/owner/repo/tag/filename.deb
          const filePath = line.substring('Filename:'.length).trim();
          filename = path.basename(filePath);
        } else if (line.startsWith('SHA256:')) {
          sha256 = line.substring('SHA256:'.length).trim();
        }
      }
      
      // If we found both filename and SHA256, add to map
      // If multiple entries have the same filename, the last one wins
      if (filename && sha256) {
        checksumMap.set(filename, sha256);
      }
    }
  } catch (error) {
    // If file doesn't exist or can't be read, return empty map
    if (error.code !== 'ENOENT') {
      // Log other errors but don't throw - allow download to proceed
      console.warn(`Warning: Could not parse Packages file: ${error.message}`);
    }
  }
  
  return checksumMap;
}

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

