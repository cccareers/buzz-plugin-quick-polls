import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type {
  Panel,
  ComposerAccessory,
  RelaySnapshot,
  ComposerAccessoryProps,
  ChannelPanelContext,
} from "@buzz/author";
// The production bundle is deliberately loaded over HTTP, never imported from src.
const pluginUrl = "/plugin.js";
const plugin = await import(pluginUrl);
type ChannelMessage = NonNullable<ComposerAccessoryProps["message"]>;
type ChannelSummary = Parameters<
  NonNullable<Panel["channelMenu"]>["eligible"]
>[0];
type Session = RelaySnapshot["session"];
const listeners = new Set<() => void>();
const channelListeners = new Set<() => void>();
let channels: ReturnType<Session["channels"]["list"]> = {
  status: "ready",
  channels: [{ id: "general", name: "general", members: ["alice"] }],
};
let supported = true;
const sent: { channelId: string; content: string; sessionId: number }[] = [];
let nextSessionId = 0;
let fail: unknown;
let attempts = 0;
function session() {
  const sessionId = ++nextSessionId;
  return {
    viewer: "alice",
    channels: {
      list: () => channels,
      subscribeList: (fn: () => void) => {
        channelListeners.add(fn);
        return () => channelListeners.delete(fn);
      },
    },
    outbox: { supports: (kind: number) => kind === 9 && supported },
    messages: {
      send: (channelId: string, content: string) => {
        attempts++;
        if (fail !== undefined) {
          const error = fail;
          fail = undefined;
          throw error;
        }
        sent.push({ channelId, content, sessionId });
        return "queued-id";
      },
    },
  } satisfies {
    viewer: Session["viewer"];
    channels: Pick<Session["channels"], "list" | "subscribeList">;
    outbox: Pick<NonNullable<Session["outbox"]>, "supports">;
    messages: Pick<Session["messages"], "send">;
  };
}
// Only the consumed host capability surface is mocked. The cast is isolated here:
// RelaySession includes many unrelated host APIs, intentionally absent in this fixture.
let state = {
  status: "ready",
  generation: 1,
  scope: "https://relay.test:alice",
  viewer: "alice",
  session: session(),
} as unknown as RelaySnapshot;
let panel!: Panel;
let accessory: ComposerAccessory;
const cleanups: (() => void)[] = [];
plugin.apply({
  react: React,
  effect: (effect: () => () => void) => {
    cleanups.push(effect());
  },
  panels: {
    register: (value: Panel) => {
      panel = value;
    },
  },
  conversation: {
    registerAccessory: (value: ComposerAccessory) => {
      accessory = value;
    },
  },
  relay: {
    snapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  },
});
const opening: ChannelPanelContext = {
  channelId: "general",
  channelName: "general",
  scope: state.scope!,
  viewer: "alice",
  relayUrl: "https://relay.test",
};
const composer = createRoot(document.getElementById("composer")!);
const tally = createRoot(document.getElementById("tally")!);
let closes = 0;
let deferClose = false;
let message: ChannelMessage | undefined;
const renderTally = () =>
  flushSync(() =>
    tally.render(
      accessory.placement === "message"
        ? React.createElement(accessory.component, {
            session: state.session,
            scope: state.scope!,
            channelId: "general",
            message,
            canOpen: () => false,
            open: () => false,
          })
        : null,
    ),
  );
const api = {
  inject: () => plugin.inject,
  open: (context: ChannelPanelContext | null = opening) =>
    flushSync(() =>
      composer.render(
        React.createElement(panel.component, {
          target: panel.id,
          channelContext: context ?? undefined,
          close: () => {
            closes++;
            if (!deferClose) flushSync(() => composer.render(null));
          },
        }),
      ),
    ),
  captured: () => ({
    sent,
    attempts,
    closes,
    subscriptions: listeners.size + channelListeners.size,
  }),
  deferClose: () => {
    deferClose = true;
  },
  eligibility: (
    patch: Partial<ChannelSummary> = {},
    viewer: string | null = "alice",
    supports = true,
  ) => {
    supported = supports;
    return panel.channelMenu!.eligible(
      { ...channels.channels[0], ...patch },
      { ...state.session, viewer: viewer ?? undefined },
    );
  },
  relay: (patch: Partial<RelaySnapshot>, notify = true) => {
    state = { ...state, ...patch };
    if (notify) flushSync(() => listeners.forEach((fn) => fn()));
  },
  channel: (patch: Partial<ChannelSummary>, notify = true) => {
    channels = {
      ...channels,
      channels: [{ ...channels.channels[0], ...patch }],
    };
    if (notify) flushSync(() => channelListeners.forEach((fn) => fn()));
  },
  replaceSession: (notify = true) => {
    state = {
      ...state,
      session: session() as unknown as RelaySnapshot["session"],
    };
    if (notify) flushSync(() => listeners.forEach((fn) => fn()));
  },
  fail: (value: string | null) => {
    fail = value === null ? "opaque failure" : new Error(value);
  },
  show: (patch: Partial<ChannelMessage> = {}) => {
    message = {
      id: "m1",
      channelId: "general",
      authorId: "alice",
      createdAt: 1,
      content: sent.at(-1)?.content ?? "",
      mentions: [],
      attachments: [],
      reactions: [],
      replyCount: 0,
      participants: [],
      ...patch,
    };
    renderTally();
  },
  update: (patch: Partial<ChannelMessage>) => {
    message = { ...message!, ...patch };
    renderTally();
  },
  removeChannel: () => {
    channels = { ...channels, channels: [] };
    flushSync(() => channelListeners.forEach((fn) => fn()));
  },
  noMessage: () => {
    message = undefined;
    renderTally();
  },
  dispose: () => {
    cleanups.forEach((fn) => fn());
  },
  unmount: () =>
    flushSync(() => {
      composer.render(null);
      tally.render(null);
    }),
};
// Discover the composer through the registered channel-menu contribution.
// Direct api.open remains available for stale/missing-context tests.
const menu = panel.channelMenu;
if (menu?.eligible(channels.channels[0], state.session)) {
  const trigger = document.createElement("button");
  trigger.textContent = menu.label;
  trigger.addEventListener("click", () => api.open());
  document.body.prepend(trigger);
}
Object.assign(window, { host: api });
document.documentElement.dataset.ready = "true";

export type Host = typeof api;
