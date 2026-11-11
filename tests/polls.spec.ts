import { test, expect, type Page } from "@playwright/test";
import type { Host } from "./fixture/host";
async function host<K extends keyof Host>(
  page: Page,
  method: K,
  ...args: Parameters<Host[K]>
): Promise<Awaited<ReturnType<Host[K]>>> {
  const result = await page.evaluate(
    ({ method, args }) => {
      const api = (
        window as unknown as {
          host: Record<string, (...args: unknown[]) => unknown>;
        }
      ).host;
      return api[method](...args);
    },
    { method, args },
  );
  return result as Awaited<ReturnType<Host[K]>>;
}
const poll =
  "📊 Poll: Lunch?\n\n1️⃣ Soup\n2️⃣ Salad\n\nVote by reacting with one of the numbered emoji.";
async function fill(page: Page) {
  await page.getByLabel("Question", { exact: true }).fill("Lunch?");
  await page.getByLabel("Option 1", { exact: true }).fill("Soup");
  await page.getByLabel("Option 2", { exact: true }).fill("Salad");
}
async function submit(page: Page) {
  await page.getByRole("button", { name: "Post poll", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Create poll", exact: true }).click();
});
test("actual public module creates, queues, closes and tallies reactive votes", async ({
  page,
}) => {
  expect(await host(page, "inject")).toEqual([
    "react",
    "panels",
    "conversation",
    "relay",
  ]);
  await fill(page);
  await submit(page);
  expect(await host(page, "captured")).toMatchObject({
    sent: [{ channelId: "general", content: poll, sessionId: 1 }],
    attempts: 1,
    closes: 1,
    subscriptions: 0,
  });
  await expect(page.getByRole("form")).toHaveCount(0);
  await host(page, "show");
  await expect(page.getByText("Poll tally · 0 votes")).toBeVisible();
  const reaction = (content: string, authors: string[], extra = {}) => ({
    content,
    events: authors.map((authorId) => ({ id: authorId + content, authorId })),
    ...extra,
  });
  await host(page, "update", {
    reactions: [
      reaction("1️⃣", ["a", "a", "b", "c"]),
      reaction("1⃣", ["b", "d"]),
      reaction("2️⃣", ["c", "e"]),
      reaction("👍", ["x"]),
      reaction("3️⃣", ["x"]),
      reaction("2️⃣", ["x"], {
        emoji: { shortcode: "two", url: "https://example.test/two.png" },
      }),
    ],
  });
  await expect(page.getByText("Poll tally · 4 votes")).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: "Option 1, 3 votes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: "Option 2, 1 vote" }),
  ).toBeVisible();
  await expect(
    page.getByText("1 voter picked multiple choices", { exact: false }),
  ).toBeVisible();
  await host(page, "update", { reactions: [reaction("2⃣", ["c"])] });
  await expect(
    page.getByText("Poll tally · 1 vote", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: "Option 1, 0 votes" }),
  ).toBeVisible();
});
test("supports exactly two through six options and removes only the last", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Remove last option" }),
  ).toHaveCount(0);
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Add option" }).click();
  await expect(page.getByRole("textbox")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Add option" })).toHaveCount(0);
  await fill(page);
  for (let i = 3; i <= 6; i++)
    await page.getByLabel(`Option ${i}`, { exact: true }).fill(`Choice ${i}`);
  await submit(page);
  expect((await host(page, "captured")).sent[0].content).toContain(
    "6️⃣ Choice 6",
  );
  await host(page, "show");
  await expect(page.getByRole("listitem")).toHaveCount(6);
  await host(page, "open");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Add option" }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Remove last option" }).click();
  await expect(page.getByRole("textbox")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Remove last option" }),
  ).toHaveCount(0);
});
test("native required, whitespace and duplicate labels block posting; correction clears error", async ({
  page,
}) => {
  await submit(page);
  expect((await host(page, "captured")).attempts).toBe(0);
  await fill(page);
  await page.getByLabel("Option 2", { exact: true }).fill("   ");
  await submit(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Enter a question and fill in each option.",
  );
  await page.getByLabel("Option 2", { exact: true }).fill(" SOUP ");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await submit(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Give each option a different label.",
  );
  await page.getByLabel("Option 2", { exact: true }).fill("Salad");
  await page.getByLabel("Question", { exact: true }).fill("   ");
  await submit(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Enter a question and fill in each option.",
  );
  expect((await host(page, "captured")).attempts).toBe(0);
});
test("trims labels and escapes Markdown literally", async ({ page }) => {
  await fill(page);
  await page
    .getByLabel("Question", { exact: true })
    .fill("  <script>*x* [y] | `z` \\  ");
  await page.getByLabel("Option 1", { exact: true }).fill(" _one_ ");
  await submit(page);
  expect((await host(page, "captured")).sent[0].content).toBe(
    "📊 Poll: \\<script\\>\\*x\\* \\[y\\] \\| \\`z\\` \\\\\n\n1️⃣ \\_one\\_\n2️⃣ Salad\n\nVote by reacting with one of the numbered emoji.",
  );
  await host(page, "show");
  await expect(page.getByText("Poll tally · 0 votes")).toBeVisible();
  await expect(page.locator("script:not([src])")).toHaveCount(0);
});
test("browser enforces question and option maximum lengths", async ({
  page,
}) => {
  await fill(page);
  const q = page.getByLabel("Question", { exact: true });
  const o = page.getByLabel("Option 1", { exact: true });
  await q.fill("");
  await q.pressSequentially("q".repeat(245));
  await o.fill("");
  await o.pressSequentially("o".repeat(125));
  await expect(q).toHaveValue("q".repeat(240));
  await expect(o).toHaveValue("o".repeat(120));
  await submit(page);
  expect((await host(page, "captured")).sent[0].content).toContain(
    "📊 Poll: " + "q".repeat(240),
  );
});
for (const failure of ["Queue unavailable", null])
  test(`queue failure ${failure} preserves inputs and allows retry once`, async ({
    page,
  }) => {
    await fill(page);
    await host(page, "fail", failure);
    await submit(page);
    await expect(page.getByRole("alert")).toHaveText(
      failure ?? "Buzz could not queue this poll.",
    );
    await expect(page.getByLabel("Question", { exact: true })).toHaveValue(
      "Lunch?",
    );
    await page.getByRole("form").evaluate((form) => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(await host(page, "captured")).toMatchObject({
      attempts: 2,
      closes: 1,
      sent: [{ content: poll }],
    });
  });
for (const patch of [
  { archived: true },
  { cached: true },
  { pending: true },
  { readOnly: true },
  { members: [] },
] as const)
  test(`channel eligibility and live revocation ${JSON.stringify(patch)}`, async ({
    page,
  }) => {
    expect(await host(page, "eligibility", patch)).toBe(false);
    await fill(page);
    await host(page, "channel", patch);
    await expect(
      page.getByRole("button", { name: "Post poll" }),
    ).toBeDisabled();
    await expect(page.getByRole("status")).toBeVisible();
    expect((await host(page, "captured")).attempts).toBe(0);
  });
test("menu requires a viewer and kind 9 support", async ({ page }) => {
  expect(await host(page, "eligibility")).toBe(true);
  expect(await host(page, "eligibility", {}, null)).toBe(false);
  expect(await host(page, "eligibility", {}, "alice", false)).toBe(false);
});
for (const patch of [
  { status: "disconnected" },
  { status: "connecting" },
  { status: "error" },
  { cached: true },
  { scope: "other" },
  { viewer: "bob" },
] as const)
  test(`live relay invalidates opening ${JSON.stringify(patch)}`, async ({
    page,
  }) => {
    await fill(page);
    await host(page, "relay", patch);
    await expect(
      page.getByRole("button", { name: "Post poll" }),
    ).toBeDisabled();
  });
for (const mutation of ["relay", "channel", "replaceSession"])
  test(`submit rechecks unannounced ${mutation} changes`, async ({ page }) => {
    await fill(page);
    if (mutation === "relay")
      await host(page, "relay", { scope: "other" }, false);
    if (mutation === "channel")
      await host(page, "channel", { readOnly: true }, false);
    if (mutation === "replaceSession")
      await host(page, "replaceSession", false);
    await submit(page);
    await expect(page.getByRole("alert")).toHaveText(
      "This channel is no longer available for posting.",
    );
    expect((await host(page, "captured")).attempts).toBe(0);
  });
test("new live session resubscribes and posts through replacement session", async ({
  page,
}) => {
  await fill(page);
  await host(page, "replaceSession");
  expect((await host(page, "captured")).subscriptions).toBe(2);
  await submit(page);
  expect((await host(page, "captured")).sent).toEqual([
    { channelId: "general", content: poll, sessionId: 2 },
  ]);
});
test("missing opening and retired plugin cannot post; unmount removes subscriptions", async ({
  page,
}) => {
  await host(page, "unmount");
  expect((await host(page, "captured")).subscriptions).toBe(0);
  await host(page, "open", null);
  await expect(page.getByRole("button", { name: "Post poll" })).toBeDisabled();
  await host(page, "unmount");
  await host(page, "open");
  await fill(page);
  await host(page, "dispose");
  await submit(page);
  expect((await host(page, "captured")).attempts).toBe(0);
  await host(page, "unmount");
  expect((await host(page, "captured")).subscriptions).toBe(0);
});
for (const delivery of [
  undefined,
  "accepted",
  "seen",
  "unknown",
  "sending",
  "failed",
] as const)
  test(`tally delivery ${delivery}`, async ({ page }) => {
    await host(page, "show", { content: poll, delivery });
    await expect(page.getByText("Poll tally · 0 votes")).toHaveCount(
      [undefined, "accepted", "seen"].includes(delivery) ? 1 : 0,
    );
  });
test("sourceContent is authoritative and edited polls suppress votes", async ({
  page,
}) => {
  await host(page, "show", { content: "projected body", sourceContent: poll });
  await expect(page.getByText("Poll tally · 0 votes")).toBeVisible();
  await host(page, "update", { edited: true });
  await expect(
    page.getByText("The tally is unavailable after a poll is edited."),
  ).toBeVisible();
  await expect(page.getByRole("list")).toHaveCount(0);
});
for (const content of [
  "ordinary message",
  poll.replace("Lunch?", "  "),
  poll.replace("\n\n1", "\n1"),
  poll.replace("2️⃣ Salad", "3️⃣ Salad"),
  poll.replace("2️⃣ Salad", "2️⃣  "),
  poll.replace("1️⃣ Soup\n", ""),
  poll + "\n",
  poll.replace("Vote by reacting", "Please vote by reacting"),
  poll.replace("\n\nVote", "\n3️⃣ A\n4️⃣ B\n5️⃣ C\n6️⃣ D\n7️⃣ E\n\nVote"),
] as const)
  test(`malformed message hides tally ${JSON.stringify(content).slice(0, 70)}`, async ({
    page,
  }) => {
    await host(page, "show", { content });
    await expect(page.locator("#tally")).toBeEmpty();
  });
for (const patch of [
  { membership: { type: "member_joined", actor: "a", target: "a" } },
  { huddle: { room: "room", state: "started" } },
  { agentEnvelope: true },
] as const)
  test(`special message hides tally ${JSON.stringify(patch)}`, async ({
    page,
  }) => {
    await host(page, "show", { content: poll, ...patch });
    await expect(page.locator("#tally")).toBeEmpty();
  });

test("raw diff messages never become polls", async ({ page }) => {
  await host(page, "show", {
    content: poll,
    diff: { truncated: false, filePath: "poll.txt" },
  });
  await expect(page.locator("#tally")).toBeEmpty();
});

test("all six choices count independent ballots", async ({ page }) => {
  const content =
    "📊 Poll: Choose\n\n" +
    ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"]
      .map((emoji, i) => `${emoji} Choice ${i + 1}`)
      .join("\n") +
    "\n\nVote by reacting with one of the numbered emoji.";
  const reactions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"].map((content, i) => ({
    content,
    events: [{ id: `event${i}`, authorId: `voter${i}` }],
  }));
  await host(page, "show", { content, reactions });
  await expect(page.getByText("Poll tally · 6 votes")).toBeVisible();
  for (let i = 1; i <= 6; i++)
    await expect(
      page.getByRole("listitem", { name: `Option ${i}, 1 vote` }),
    ).toBeVisible();
});
test("all excluded voters use plural explanation until they remove extra choices", async ({
  page,
}) => {
  const events = [
    { id: "a", authorId: "a" },
    { id: "b", authorId: "b" },
  ];
  await host(page, "show", {
    content: poll,
    reactions: [
      { content: "1️⃣", events },
      { content: "2️⃣", events },
    ],
  });
  await expect(page.getByText("Poll tally · 0 votes")).toBeVisible();
  await expect(
    page.getByText("2 voters picked multiple choices", { exact: false }),
  ).toBeVisible();
  await host(page, "update", { reactions: [{ content: "2️⃣", events }] });
  await expect(page.getByText("Poll tally · 2 votes")).toBeVisible();
  await expect(page.getByText("voters picked", { exact: false })).toHaveCount(
    0,
  );
});
test("channel removal revokes posting and missing message renders nothing", async ({
  page,
}) => {
  await host(page, "removeChannel");
  await expect(page.getByRole("button", { name: "Post poll" })).toBeDisabled();
  await host(page, "noMessage");
  await expect(page.locator("#tally")).toBeEmpty();
});
test("Enter submits the form through native keyboard behavior", async ({
  page,
}) => {
  await fill(page);
  await page.getByLabel("Option 2", { exact: true }).press("Enter");
  expect((await host(page, "captured")).sent).toHaveLength(1);
});
