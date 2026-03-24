# Setting up with Cloudflare Workers

Thinking of using [Cloudflare](https://www.cloudflare.com/) as a host? If you already have an account there, it's the obvious choice. If you don't yet, it's worth considering. Their [usage-based pricing](https://developers.cloudflare.com/workers/platform/limits/#account-plan-limits) is low and a small site like this probably fits in to the free tier.[^1]

[^1]: Specifically, this guide uses [Cloudflare Workers for Static Assets](https://developers.cloudflare.com/workers/static-assets/). Their documentation on Workers is interspersed references to handling requests with Worker scripts, but we're organizing things to rely *purely* on static assets and redirects. No server-side scripts are involved, so no need to worry about how those are metered.

Before we get in to setting up the host, we'll want somewhere to store package metadata. We can use an independent branch for this within your current git repository:

```sh
git switch --orphan apt-repo
```

The site needs a name for reference in your Cloudflare account. It will also appear as part of the site's default URL. If your GitHub project is _foo-bar_, you could stick with that, but you may want to add `repo` or `dl` or `releases` or something like that to help disambiguate.

Use that name in place of `your-site-name-here` in the command below. It will run a starter kit to set up for Cloudflare deployment.
```sh
pnpm create cloudflare@latest your-site-name-here \
  --git --no-deploy \
  --template=https://github.com/keturn/gh-release-apt/integrations/cloudflare/templates/
```

Commit before tinkering further:

```sh
git add --all
git commit -m 'initial cloudflare worker config'
```

Now to build your repo. We can automate updates to it later, but let's walk through it manually the first time to see how it's supposed to work:

```sh
cd your-site-name-here
pnpm exec gh-release-apt import -o public your-repo-owner/your-repo
pnpm exec gh-release-apt assemble -o public

git add --all
git commit -m 'imported Debian packages from latest release'
```

There should now be `dists` and `pool` subdirectories beneath the `public` content directory, ready for upload.

For a manual release, you could deploy now and Cloudflare's wrangler would use your browser to log you in and prompt for authorization.

For automated workflows, you'll want to [create an API token]( https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%5D&name=Package%20Repository%20Workers) for this purpose.
It requires the **Workers Scripts** permission.

> [!NOTE]
> You can limit the token permission to only interacting with Workers,
> but it applies equally to *all* workers on that Cloudflare account.

(Reference: [Workers with GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/#1-authentication))

As always, never commit any API token to a GitHub Workflow YAML file or any other file in a public git repository.
Store `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as [GitHub Secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

For our initial trial run, you can set them as environment variables:
```sh
 export CLOUDFLARE_ACCOUNT_ID=012345678abcdef…
 export CLOUDFLARE_API_TOKEN=super_secret_token…

pnpm run deploy
```

## TODO

- [ ] Add notes on [using your own domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/#add-a-custom-domain) for the URL.
- [ ] Write the sharable workflow that automates the above.
  - inputs:
    - branch name (default `apt-repo`), path
    - secrets: `SIGNING_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
  - On release.released: (Also consider `published`. Unclear if there's an event trigger for changed assets, which is what we really want.)
  - use [checkout](https://github.com/actions/checkout) to clone the `apt-repo` branch.
  - run gh-release-apt import. (ideally on the release.tag_name, but maybe we haven't implemented specifying that yet?)
  - run gh-release-apt assemble.
  - if we got this far, should commit and push the `apt-repo` branch. (Do we need to identify as the github-actions bot, [as in the example](https://github.com/actions/checkout#push-a-commit-using-the-built-in-token)?)
  - use [wrangler-action](https://github.com/cloudflare/wrangler-action) to deploy.


## Considerations

### Do I really need to create and maintain this `apt-repo` git branch?

If you're sure your package repository should never have records of more than one release, you can skip that.


### Why run wrangler instead of having Cloudflare publish directly from that branch?

1. There are generated files we haven't committed to the branch, to avoid bloating the git repository.
2. The goal is to make hosting approachable and maintainable for GitHub project maintainers. I think “there's a GitHub Action that does it” will feel more familiar than “it's somewhere in the Cloudflare config.”
