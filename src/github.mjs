import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { Writable } from 'stream';
import { parsePackagesFile } from './repository.mjs';

/**
 * Fetches the latest release for a GitHub repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} [token] - Optional GitHub token for authentication
 * @returns {Promise<Object>} The latest release object
 * @throws {Error} If the release cannot be fetched or doesn't exist
 */
export async function getLatestRelease(owner, repo, token) {
  const octokit = new Octokit({
    auth: token || process.env.GITHUB_TOKEN,
  });

  try {
    const { data: release } = await octokit.rest.repos.getLatestRelease({
      owner,
      repo,
    });

    if (!release) {
      throw new Error(`No latest release found for ${owner}/${repo}`);
    }

    return release;
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`No releases found for ${owner}/${repo}`);
    }
    if (error.status === 401 || error.status === 403) {
      throw new Error(`Authentication failed. Check your GitHub token.`);
    }
    throw new Error(`Failed to fetch release: ${error.message}`);
  }
}

/**
 * Filters .deb assets from a GitHub release
 * @param {Object} release - GitHub release object
 * @returns {Array} Array of .deb asset objects
 */
export function filterDebAssets(release) {
  return release.assets.filter((asset) =>
    asset.name.endsWith('.deb')
  );
}

/**
 * Downloads all .deb assets from a GitHub release
 * @param {Object} release - GitHub release object
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} outputDir - Root directory for the APT repository
 * @param {string} [token] - Optional GitHub token for authentication
 * @param {Function} [downloadFn] - Optional download function (for testing)
 * @returns {Promise<string[]>} Array of paths to downloaded .deb files
 * @throws {Error} If download fails
 */
export async function downloadDebAssets(release, owner, repo, outputDir, token, downloadFn = downloadFile) {
  const debAssets = filterDebAssets(release);

  // Construct path: pool/{owner}/{repo}/{tag_name}/
  const downloadDir = path.join(outputDir, 'pool', owner, repo, release.tag_name);
  
  // Ensure output directory exists
  await fs.mkdir(downloadDir, { recursive: true });

  // Determine Packages file path (same logic as organizeDebFiles)
  const packagesPath = path.join(downloadDir, 'Packages');
  
  // Parse existing Packages file to get filename -> SHA256 mappings
  const existingChecksums = await parsePackagesFile(packagesPath);

  const authHeader = token || process.env.GITHUB_TOKEN;
  const downloadedFiles = [];

  for (const asset of debAssets) {
    const filePath = path.join(downloadDir, asset.name);
    
    // Check if asset is already in Packages file with matching SHA256
    const existingSHA256 = existingChecksums.get(asset.name);
    
    // Extract SHA256 from GitHub asset digest field (format: "sha256:...")
    let assetSHA256 = null;
    if (asset.digest && typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')) {
      assetSHA256 = asset.digest.substring(7); // Remove "sha256:" prefix
    }
    
    if (existingSHA256 && assetSHA256) {
      // Compare checksums (case-insensitive comparison)
      if (existingSHA256.toLowerCase() === assetSHA256.toLowerCase()) {
        // Check if file exists on disk before skipping
        try {
          await fs.access(filePath);
          downloadedFiles.push(filePath);
          console.log(`Skipped: ${asset.name} (checksum matches)`);
          continue;
        } catch {
          // File doesn't exist, proceed with download
        }
      }
    }

    // Download the asset if checksums don't match, don't exist, or file is missing
    try {
      await downloadFn(asset.browser_download_url, filePath, authHeader);
      downloadedFiles.push(filePath);
      console.log(`Downloaded: ${asset.name}`);
    } catch (error) {
      throw new Error(`Failed to download ${asset.name}: ${error.message}`);
    }
  }

  return downloadedFiles;
}

/**
 * Downloads a file from a URL to a local path
 * @param {string} url - URL to download from
 * @param {string} filePath - Local path to save the file
 * @param {string} [token] - Optional GitHub token for authentication
 * @returns {Promise<void>}
 * @private Exported for testing purposes only
 */
export async function downloadFile(url, filePath, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`
    );
  }

  const fileStream = Writable.toWeb(createWriteStream(filePath));
  await response.body.pipeTo(fileStream);
}

