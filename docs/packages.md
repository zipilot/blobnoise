# GitHub Packages distribution

Package: `@alejo-valencia/blobnoise`

Registry: `https://npm.pkg.github.com`

Personal-scope release: `0.1.0` (publication verification pending).

The repository moved to
[alejo-valencia/blobnoise](https://github.com/alejo-valencia/blobnoise) on
2026-09-11. GitHub's granular npm packages do not move with repositories, so
the personal account uses a new scope. Authentication remains required.

To enable public package visibility, a package administrator
must open the package page, choose **Package settings**, and change visibility
to **Public**. GitHub documents this as a web-settings action; no browser
session or broader personal credentials were provisioned by this project.
Installation requires an identity with package access.
Even after making it public, GitHub's npm registry still requires authentication.

This is an npm-format package on GitHub Packages, not a publication to
npmjs.org. The GitHub registry requires a scope, so earlier local examples
using `blobnoise/browser` or `@zipilot/blobnoise/browser` must use
`@alejo-valencia/blobnoise/browser` for the personal-scope package.
Configuration JSON, seeds and rendering behavior are unchanged.

## Install locally

Add this non-secret mapping to the consuming project's `.npmrc`:

```ini
@alejo-valencia:registry=https://npm.pkg.github.com
```

Then authenticate and install:

```sh
npm login --scope=@alejo-valencia --auth-type=legacy --registry=https://npm.pkg.github.com
npm install @alejo-valencia/blobnoise@0.1.0
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
      scope: "@alejo-valencia"
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
gh workflow run publish-package.yml --repo alejo-valencia/blobnoise --ref main
```

The version in `packages/blobnoise/package.json` is authoritative. Do not
rerun a successful publication for an existing version: versions are immutable.
Do not delete and republish an existing version to hide a release problem.
To recheck an existing release without attempting another publication:

```sh
gh workflow run publish-package.yml --repo alejo-valencia/blobnoise --ref main -f verify_only=true
```

The verification-only mode also reports actual package visibility. It does
not delete, overwrite or republish a version.

The `repository` field connects the package to `alejo-valencia/blobnoise`.
`publishConfig.registry` prevents accidentally targeting npmjs.org.
`publishConfig.access` requests public access, but GitHub's resulting package
visibility/access settings must be inspected rather than inferred from that
flag or from the public repository. Repository permission inheritance and
package visibility are separate settings.

## Legacy organization package

The existing `@zipilot/blobnoise@0.1.0` release has not been deleted. GitHub
keeps granular packages under their original owner and removes their
repository link/access inheritance when the repository is transferred.
Consumers of that scope may need explicit access to the old package or
migration to the personal scope; do not assume the source URL redirect also
redirects npm installs.

The [initial release workflow](https://github.com/alejo-valencia/blobnoise/actions/runs/34540877755)
published the legacy organization version and installed it in a clean
consumer. All four entry imports, JSON/snippet behavior and declarations
were exercised.

A [verification-only run](https://github.com/alejo-valencia/blobnoise/actions/runs/34541147632)
repeated the clean installation, skipped publication and reported the package's
private visibility and association with `zipilot/blobnoise` before transfer.

The original MIT copyright and third-party notices are retained. Repository
ownership changes do not remove existing license notices.

Sources, read 2026-09-10:
[npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
and [package permissions](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).
