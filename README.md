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
