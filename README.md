# Debian Repositories (apt support) for GitHub Releases

It's great when GitHub-hosted projects produce `.deb` packages in their release workflow[^1],
but GitHub has never bothered to make a GitHub project something you can add to your system's `sources.list` to get ongoing updates.

Here we aim to make it easy and affordable to make an apt-compatible repository for your releases.

[^1]: Shoutout to [GoReleaser](https://goreleaser.com/) and [Tauri](https://v2.tauri.app/distribute/debian/) as a few tools I've seen enabling Debian packaging in the wild.


## Usage

### Importing a Release

Import packages from your latest release:

`gh-release-apt import owner/repo`

If you want your repository to retain multiple versions,
do save the resulting `pool/**/Packages` files (to version control or a persistent filesystem) so this release's packages don't have to be downloaded again next time.


### Building the Repository

`gh-release-apt assemble`

Then deploy to your server—_excluding_ the `.deb` files themselves.


## Design

The key feature we rely on is that apt will follow redirects.
This means we *can* keep using standard GitHub Release asset hosting for the packages themselves—
which is great, because we don't want the overhead of storing extra copies of them,
GitHub keeps paying for the bandwidth,
and the project's download analytics keep working.

[GitHub Pages doesn't offer a way to configure redirects](https://github.com/orgs/community/discussions/86095),
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
