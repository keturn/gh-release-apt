import { Octokit } from '@octokit/rest';
import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { URL } from 'url';

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
 * Downloads all .deb assets from a GitHub release
 * @param {Object} release - GitHub release object
 * @param {string} outputDir - Directory to save downloaded files
 * @param {string} [token] - Optional GitHub token for authentication
 * @returns {Promise<string[]>} Array of paths to downloaded .deb files
 * @throws {Error} If download fails
 */
export async function downloadDebAssets(release, outputDir, token) {
  if (!release.assets || release.assets.length === 0) {
    throw new Error(`Release ${release.tag_name} has no assets`);
  }

  // Filter assets that end with .deb
  const debAssets = release.assets.filter((asset) =>
    asset.name.endsWith('.deb')
  );

  if (debAssets.length === 0) {
    throw new Error(
      `Release ${release.tag_name} has no .deb assets to download`
    );
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const authHeader = token || process.env.GITHUB_TOKEN;
  const downloadedFiles = [];

  for (const asset of debAssets) {
    const filePath = path.join(outputDir, asset.name);

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
function downloadFile(url, filePath, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const headers = {};
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    httpModule
      .get(url, { headers }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect location not provided'));
            return;
          }
          // Resolve relative redirects
          const absoluteRedirectUrl = new URL(redirectUrl, url).href;
          return downloadFile(absoluteRedirectUrl, filePath, token)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to download: ${response.statusCode} ${response.statusMessage}`
            )
          );
          return;
        }

        const fileStream = createWriteStream(filePath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(filePath).catch(() => {});
          reject(err);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

