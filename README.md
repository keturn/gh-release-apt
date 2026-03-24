# Debian Repositories (apt support) for GitHub Releases

It's great when GitHub-hosted projects produce `.deb` packages in their release workflow[^1],
but GitHub has never bothered to make a GitHub project something you can add to your system's `sources.list` to get ongoing updates.

Here we aim to make it easy and affordable to make an apt-compatible repository for your releases.

[^1]: Shoutout to [GoReleaser](https://goreleaser.com/) and [Tauri](https://v2.tauri.app/distribute/debian/) as a few tools I've seen enabling Debian packaging in the wild.


## Requirements

```sh
sudo apt-get install --no-recommends dpkg-dev sq xz-utils
```

And [Node.js v24 (LTS)](https://nodejs.org/en/download) with pnpm.


## Usage

### Importing a Release

Import packages from your latest release:

`gh-release-apt import owner/repo`

If you want your repository to retain multiple versions,
do save the resulting `pool/**/Packages` files (to version control or a persistent filesystem) so this release's packages don't have to be downloaded again next time.


### Building the Repository

With your signing key in the `SIGNING_KEY` environment variable, run:

`gh-release-apt assemble`

Then deploy to your server—_excluding_ the `.deb` files themselves.


## Host-Specific Integration Guides

- [Cloudflare](integrations/cloudflare/README.md)
- … <!-- Additions welcome! -->


## Design

The key feature we rely on is that apt will follow redirects.
This means we *can* keep using standard GitHub Release asset hosting for the packages themselves—
which is great, because we don't want the overhead of storing extra copies of them,
GitHub keeps paying for the bandwidth,
and the project's download analytics keep working.

[GitHub Pages doesn't provide a way to configure redirects](https://github.com/orgs/community/discussions/86095),
but other hosts do offer this in their static web hosting features.[^2]
There is, however, often a limit on the number of redirect rules.
For that reason, we organize the repository's package pool so it's easy to map back to GitHub URLs with a single rule (instead of Debian's alphabetized structure).

[^2]: including [GitLab Pages](https://docs.gitlab.com/user/project/pages/redirects/), 
[CloudFlare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/redirects/), 
[AWS S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/how-to-page-redirect.html) or 
[AWS Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html), 
[NearlyFreeSpeech](https://faq.nearlyfreespeech.net/full/htaccess#htaccess), 
[Firebase](https://firebase.google.com/docs/hosting/full-config#redirects),
[Netlify](https://docs.netlify.com/manage/routing/redirects/overview/),
[Vercel](https://vercel.com/docs/redirects/configuration-redirects),
[Digital Ocean](https://docs.digitalocean.com/products/app-platform/how-to/url-rewrites/#configure-a-redirect),
[Render](https://render.com/docs/redirects-rewrites),
[pico.sh](https://pico.sh/pgs#-redirects),
[Codeberg](https://docs.codeberg.org/codeberg-pages/redirects/),
etc.

### Security Considerations 

No code from the target GitHub repository or its release assets is executed in the process of creating the package repository.

Assets named `*.deb` are downloaded and _extracted,_ so if we ever get another arbitrary code execution exploit in a decompression routine,
*that* would run with access to your signing key and write permissions to both your git repository and package repository.
But anything able to add an asset to your GitHub Release probably has all that already.

The usual supply chain considerations apply for gh-release-apt. (As well as any other tools you use during deployment, e.g. wrangler.)

Debian and Ubuntu-based systems extend a *lot* of trust to package repositories.
System administrators are encouraged to use the [pinning mechanism of APT Preferences](https://manpages.debian.org/testing/apt/apt_preferences.5.en.html#The_Effect_of_APT_Preferences) to limit what third-party repositories are used for,
but this doesn't happen by default and the manual even [discourages it for novices](https://www.debian.org/doc/manuals/debian-reference/ch02.en.html#_tweaking_candidate_version).
Users should assume that adding your repository to their system's sources will allow you (the repository owner) to run unrestricted code any time they `install` or `upgrade` ***any*** package,
*even if the name of the package has nothing to do with your project.*


## Appendix: Creating a Signing Key

This is not the only way to create a signing key, but if you don't have one already,
this creates a minimal key for signing only.

```sh
sq key generate --without-password --can-sign --cannot-encrypt --cannot-authenticate --shared-key --no-userids
sq cert export --cert $FINGERPRINT | sq packet dearmor --output archive-keyring.pgp
sq key export --cert $FINGERPRINT | gh secret set SIGNING_KEY
```

See [DebianRepository/UseThirdParty](https://wiki.debian.org/DebianRepository/UseThirdParty#OpenPGP_certificate_distribution)
for recommendations on where to name and place the certificate.
