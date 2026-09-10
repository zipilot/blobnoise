# GitHub Packages distribution

Package: `@zipilot/blobnoise`

Registry: `https://npm.pkg.github.com`

Initial version: `0.1.0`

This is an npm-format package on GitHub Packages, not a publication to
npmjs.org. The GitHub registry requires a scope, so earlier local examples
using `blobnoise/browser` must use `@zipilot/blobnoise/browser` instead.
Configuration JSON, seeds and rendering behavior are unchanged.

## Install locally

Add this non-secret mapping to the consuming project's `.npmrc`:

```ini
@zipilot:registry=https://npm.pkg.github.com
```

Then authenticate and install:

```sh
npm login --scope=@zipilot --auth-type=legacy --registry=https://npm.pkg.github.com
npm install @zipilot/blobnoise@0.1.0
```

Use your GitHub username and a personal access token **classic** with
`read:packages` and access to the package. Authorize organization SSO if
required. Do not paste tokens into issues, chat, source or committed `.npmrc`
files. GitHub requires authentication even for public npm packages; public
repository visibility does not imply anonymous registry access.

## Install in another repository's GitHub Actions

For a repository granted Actions access to the package:

```yaml
permissions:
  contents: read
  packages: read
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
      registry-url: https://npm.pkg.github.com
      scope: "@zipilot"
  - run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Add the dependency and update the consuming project's lockfile first.
If the consuming repository's `GITHUB_TOKEN` lacks access, a package admin
must grant that repository read access under the package's **Manage Actions
access** settings, or use a narrowly scoped classic PAT stored as an Actions
secret. Merely setting `packages: read` does not grant cross-repository access.

## Publish a new version

The manually dispatched **Publish npm package** workflow runs only from
`main`, with `contents: read` and `packages: write`. It installs locked
dependencies, typechecks/tests, builds the four package entries, publishes,
then installs that exact version from the registry in a clean temporary
consumer and exercises its ESM/configuration/type contracts.

Maintainers must update both the package version and the studio dependency
version, refresh `package-lock.json`, and push a reviewed commit before
dispatching the workflow:

```sh
gh workflow run publish-package.yml --repo zipilot/blobnoise --ref main
```

The version in `packages/blobnoise/package.json` is authoritative. Do not
rerun a successful publication for an existing version: versions are immutable.
Do not delete and republish an existing version to hide a release problem.
If only the post-publication consumer check fails, fix that check and run it
with an authorized token without attempting to publish the version again.

The `repository` field connects the package to `zipilot/blobnoise`.
`publishConfig.registry` prevents accidentally targeting npmjs.org.
`publishConfig.access` requests public access, but GitHub's resulting package
visibility/access settings must be inspected rather than inferred from that
flag or from the public repository. Repository permission inheritance and
package visibility are separate settings.

Sources, read 2026-09-10:
[npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
and [package permissions](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).
