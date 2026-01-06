import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { Writable } from 'stream';

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
 * @returns {Promise<string[]>} Array of paths to downloaded .deb files
 * @throws {Error} If download fails
 */
export async function downloadDebAssets(release, owner, repo, outputDir, token) {
  const debAssets = filterDebAssets(release);

  // Construct path: pool/{owner}/{repo}/{tag_name}/
  const downloadDir = path.join(outputDir, 'pool', owner, repo, release.tag_name);
  
  // Ensure output directory exists
  await fs.mkdir(downloadDir, { recursive: true });

  const authHeader = token || process.env.GITHUB_TOKEN;
  const downloadedFiles = [];

  for (const asset of debAssets) {
    const filePath = path.join(downloadDir, asset.name);

    try {
      await downloadFile(asset.browser_download_url, filePath, authHeader);
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
 */
async function downloadFile(url, filePath, token) {
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

