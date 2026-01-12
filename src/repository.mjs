import fs from 'fs/promises';
import path from 'path';

/**
 * Splits Packages file content into individual package entry blocks
 * @param {string} packagesContent - Content of a Packages file
 * @returns {string[]} Array of entry blocks (trimmed)
 */
function splitPackagesEntries(packagesContent) {
  return packagesContent.split(/\n\s*\n/).filter(entry => entry.trim());
}

/**
 * Extracts the value of a field from a package entry
 * @param {string} entry - Package entry block
 * @param {string} fieldName - Name of the field to extract (e.g., 'Architecture', 'Filename', 'SHA256')
 * @returns {string|null} Field value or null if not found
 */
function extractFieldFromEntry(entry, fieldName) {
  const prefix = `${fieldName}:`;
  for (const line of entry.split('\n')) {
    if (line.startsWith(prefix)) {
      return line.substring(prefix.length).trim();
    }
  }
  return null;
}

/**
 * Extracts filename to SHA256 checksum mappings from a Packages file
 * @param {string} packagesPath - Path to the Packages file
 * @returns {Promise<Map<string, string>>} Map of filename (basename) to SHA256 checksum
 */
export async function extractChecksumMap(packagesPath) {
  const checksumMap = new Map();

  try {
    const content = await fs.readFile(packagesPath, 'utf-8');
    const entries = splitPackagesEntries(content);
    
    for (const entry of entries) {
      const filePath = extractFieldFromEntry(entry, 'Filename');
      const sha256 = extractFieldFromEntry(entry, 'SHA256');
      
      if (filePath && sha256) {
        const filename = path.basename(filePath);
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
 * Extracts package entries grouped by their Architecture field from Packages file content
 * @param {string} packagesContent - Content of a Packages file
 * @returns {Array<{architecture: string, entry: string}>} Array of entries with their architecture
 */
export function extractEntriesByArchitecture(packagesContent) {
  const entries = [];
  const entryBlocks = splitPackagesEntries(packagesContent);
  
  for (const entryBlock of entryBlocks) {
    const architecture = extractFieldFromEntry(entryBlock, 'Architecture');
    
    if (architecture) {
      entries.push({
        architecture,
        entry: entryBlock.trim()
      });
    }
  }
  
  return entries;
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

