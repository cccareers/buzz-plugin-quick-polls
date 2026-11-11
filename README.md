# Quick Polls

Create quick channel polls on Buzz desktop v1.0.0. Each poll is a regular message. Teammates can read the question and vote with Buzz's built-in reactions, even if they never install the plugin.


## Run a poll

1. In a writable team channel, open its header menu and select **Create poll**.
2. Write a question and add two to six distinct options. Select **Post poll**.
3. Vote by adding one of the numbered emoji as a native reaction. To change your vote, remove the old reaction and add the new one.
4. Read **Poll tally** below the message on a client with the plugin. Buzz shows the message's delivery status and handles retries in the channel.

The tally counts distinct Buzz signing identities from the message's current reactions. Duplicate reactions for the same choice count once. If an identity reacts to multiple listed choices, that identity is excluded until only one choice remains. Other emoji have no effect. Votes are visible as regular Buzz reactions. An edit to the poll message hides its tally so changed options cannot inherit existing votes. Post a new poll if the options need to change.

Quick Polls uses the signed-in Buzz session and its normal channel access and delivery rules. The manifest requests no additional host grants. There is no external service or separate poll data store.

## Install in Buzz desktop v1.0.0

For a local checkout, open **Settings → Plugins → Manage plugins → Add**, choose **Browse** under **Add from folder**, and select this repository’s root. Review the plugin and select **Install plugin**.

Once the GitHub repository is available, paste the following URL into **Git or GitHub repository** in the same dialog, select **Find**, then review and install the plugin.

`https://github.com/cccareers/buzz-plugin-quick-polls`

## Build

Use Node.js 20 or later.

```sh
npm ci
npm run build
```

The build writes the self-contained `plugin.js` beside `manifest.json`. Commit the rebuilt file when you change the plugin. Buzz’s Git installer reads the committed bundle. `npm ci` also installs the pinned Buzz author types for editors.

## Automated checks

```sh
npm ci
npx playwright install chromium firefox webkit
npm test
```

`npm test` first checks the shipped artifact against a fresh isolated build, then typechecks the plugin and runs the browser suite. `npm run test:e2e -- --project=chromium` runs one browser; the default runs headless Chromium, Firefox, and WebKit. Linux CI uses the official Playwright image with browsers and system dependencies preinstalled; keep its image version aligned with `@playwright/test` in `package.json`. For local Linux setup, use `npx playwright install --with-deps chromium firefox webkit`. Failed browser runs retain Playwright traces under `test-results/` (`npx playwright show-trace <trace.zip>`).

The browser fixture bundles real React and loads the actual root `plugin.js` as an ES module through its public `inject`/`apply` entry points. It renders registered panel and message accessory components. Only Buzz host boundaries are mocked: current relay/session snapshots, channel subscriptions, eligibility inputs, synchronous message queue acceptance/failure, contribution registration, and effect cleanup. Tests cover creating and queuing polls, validation, limits, Markdown escaping, stale context/session changes, disposal, message recognition and live reaction tally updates. The fixture HTTP server serves only its page, React fixture bundle, and plugin bundle.

These checks do not run the Buzz desktop application, prove relay authorization or cryptographic identity verification, send real messages, or emulate native reaction controls/delivery retries. Reaction/message snapshots are supplied in the host's public author-contract shape; the fixture isolates its partial RelaySession cast because unrelated host services are intentionally absent. Desktop integration remains a separate manual check.
