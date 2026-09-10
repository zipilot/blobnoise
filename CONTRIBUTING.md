# Contributing

Use Node.js 22.12+ and npm workspaces. Run `npm ci`, then `npm run dev`.
Before submitting changes, run `npm run check`. Browser tests require
`npx playwright install chromium` (Linux CI also installs browser OS dependencies).

Keep the core free of browser/React imports. The website must use public
package entry points rather than duplicate shader, timeline or export logic.
Load media encoding only through the export path.

Preserve seeds, algorithm version and explicit-time behavior. Intentional
algorithm changes require a new algorithm identifier and compatibility
decision, not silently different saved presets. Add coverage for new
configuration fields, temporal loops, browser failures and cleanup.

Use original shaders, examples and presets or include the applicable license
and attribution for deliberate third-party reuse. Do not include copied
branding, personal data, credentials, telemetry or uploaded design data.

Publishing the package or deploying the website is a separate maintainer
action. CI builds and exercises the project; it does not publish anything.
