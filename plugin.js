// src/plugin.tsx
var inject = ["react", "panels", "conversation", "relay"];
var choices = ["1\uFE0F\u20E3", "2\uFE0F\u20E3", "3\uFE0F\u20E3", "4\uFE0F\u20E3", "5\uFE0F\u20E3", "6\uFE0F\u20E3"];
var heading = "\u{1F4CA} Poll: ";
var instructions = "Vote by reacting with one of the numbered emoji.";
var questionLimit = 240;
var optionLimit = 120;
var normalizeEmoji = (value) => value.replace(/\uFE0F(?=\u20E3)/g, "");
function plainText(value) {
  return value.replace(/[\\`*_~<>[\]|]/g, "\\$&");
}
function formatPoll(question, options) {
  return [
    heading + plainText(question),
    "",
    ...options.map((option, index) => `${choices[index]} ${plainText(option)}`),
    "",
    instructions
  ].join("\n");
}
function pollChoices(message) {
  if (message.membership || message.huddle || message.agentEnvelope) return [];
  const lines = (message.sourceContent ?? message.content).split("\n");
  const options = lines.slice(2, -2);
  if (!lines[0]?.startsWith(heading) || !lines[0].slice(heading.length).trim() || lines[1] !== "" || lines.at(-2) !== "" || lines.at(-1) !== instructions || options.length < 2 || options.length > choices.length || !options.every((option, index) => {
    const prefix = `${choices[index]} `;
    return option.startsWith(prefix) && !!option.slice(prefix.length).trim();
  })) return [];
  return choices.slice(0, options.length);
}
function countVotes(reactions, options) {
  const accepted = options.map(normalizeEmoji);
  const ballots = /* @__PURE__ */ new Map();
  for (const reaction of reactions) {
    if (reaction.emoji) continue;
    const choice = accepted.indexOf(normalizeEmoji(reaction.content));
    if (choice < 0) continue;
    for (const { authorId } of reaction.events) {
      const ballot = ballots.get(authorId) ?? /* @__PURE__ */ new Set();
      ballot.add(choice);
      ballots.set(authorId, ballot);
    }
  }
  const counts = options.map(() => 0);
  let excluded = 0;
  for (const ballot of ballots.values()) {
    if (ballot.size === 1) {
      for (const choice of ballot) counts[choice] += 1;
    } else {
      excluded += 1;
    }
  }
  return { counts, excluded, valid: ballots.size - excluded };
}
var canPost = (channel, session) => !!(session.viewer && channel.members?.includes(session.viewer) && !channel.archived && !channel.cached && !channel.pending && !channel.readOnly && session.outbox?.supports(9));
function channelFor(state, opening, channels = state.session.channels.list().channels) {
  if (!opening || state.status !== "ready" || state.cached || state.scope !== opening.scope || state.viewer !== opening.viewer) return void 0;
  const channel = channels.find(({ id }) => id === opening.channelId);
  return channel && canPost(channel, state.session) ? channel : void 0;
}
var captionStyle = {
  margin: 0,
  color: "var(--text-subtle)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--text-caption--line-height)",
  letterSpacing: "var(--text-caption--letter-spacing)",
  overflowWrap: "anywhere"
};
var apply = (ctx) => {
  const React = ctx.react;
  let active = true;
  ctx.effect(() => () => {
    active = false;
  });
  function PollComposer({ channelContext, close }) {
    const [question, setQuestion] = React.useState("");
    const [options, setOptions] = React.useState(["", ""]);
    const [error, setError] = React.useState("");
    const posted = React.useRef(false);
    const relay = React.useSyncExternalStore(ctx.relay.subscribe, ctx.relay.snapshot);
    const channels = React.useSyncExternalStore(
      relay.session.channels.subscribeList,
      relay.session.channels.list
    );
    const channel = channelFor(relay, channelContext, channels.channels);
    function updateOption(index, value) {
      setOptions(
        (previous) => previous.map((option, position) => position === index ? value : option)
      );
      setError("");
    }
    return /* @__PURE__ */ React.createElement(
      "form",
      {
        "aria-label": "Create poll",
        style: {
          display: "grid",
          gap: "var(--space-3)",
          padding: "var(--space-panel-inset)",
          maxWidth: "36rem"
        },
        onSubmit: (event) => {
          event.preventDefault();
          if (!active || !event.currentTarget.isConnected || posted.current) return;
          const current = ctx.relay.snapshot();
          const destination = channelFor(current, channelContext);
          if (!destination || current.session !== relay.session) {
            setError("This channel is no longer available for posting.");
            return;
          }
          const prompt = question.trim();
          const labels = options.map((option) => option.trim());
          if (!prompt || labels.some((label) => !label)) {
            setError("Enter a question and fill in each option.");
            return;
          }
          if (new Set(labels.map((label) => label.toLowerCase())).size !== labels.length) {
            setError("Give each option a different label.");
            return;
          }
          posted.current = true;
          try {
            current.session.messages.send(destination.id, formatPoll(prompt, labels));
          } catch (failure) {
            posted.current = false;
            setError(failure instanceof Error ? failure.message : "Buzz could not queue this poll.");
            return;
          }
          close();
        }
      },
      channel && /* @__PURE__ */ React.createElement("p", { style: captionStyle }, "Posts to #", channel.name),
      !channel && /* @__PURE__ */ React.createElement("p", { style: captionStyle, role: "status" }, "Connect to a writable channel to post a poll."),
      /* @__PURE__ */ React.createElement("label", { style: { display: "grid", gap: "var(--space-1)" } }, "Question", /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "buzz-input",
          "data-buzz-ui": "",
          type: "text",
          maxLength: questionLimit,
          value: question,
          required: true,
          onChange: (event) => {
            setQuestion(event.currentTarget.value);
            setError("");
          }
        }
      )),
      /* @__PURE__ */ React.createElement("fieldset", { style: { minWidth: 0, padding: 0, margin: 0, border: 0 } }, /* @__PURE__ */ React.createElement("legend", { style: { marginBottom: "var(--space-2)" } }, "Options"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: "var(--space-2)" } }, options.map((option, index) => /* @__PURE__ */ React.createElement(
        "label",
        {
          key: index,
          style: {
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr)",
            alignItems: "center",
            gap: "var(--space-2)"
          }
        },
        /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, choices[index]),
        /* @__PURE__ */ React.createElement(
          "input",
          {
            className: "buzz-input",
            "data-buzz-ui": "",
            "aria-label": `Option ${index + 1}`,
            type: "text",
            maxLength: optionLimit,
            value: option,
            required: true,
            onChange: (event) => updateOption(index, event.currentTarget.value)
          }
        )
      )))),
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "var(--space-2)" } }, options.length < choices.length && /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "buzz-button",
          "data-buzz-ui": "",
          "data-variant": "subtle",
          "data-size": "sm",
          type: "button",
          onClick: () => {
            setOptions((previous) => previous.length < choices.length ? [...previous, ""] : previous);
            setError("");
          }
        },
        "Add option"
      ), options.length > 2 && /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "buzz-button",
          "data-buzz-ui": "",
          "data-variant": "ghost",
          "data-size": "sm",
          type: "button",
          onClick: () => {
            setOptions((previous) => previous.length > 2 ? previous.slice(0, -1) : previous);
            setError("");
          }
        },
        "Remove last option"
      )),
      error && /* @__PURE__ */ React.createElement("p", { style: { ...captionStyle, color: "var(--text-danger)" }, role: "alert" }, error),
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "buzz-button",
          "data-buzz-ui": "",
          "data-variant": "prominent",
          "data-size": "sm",
          type: "submit",
          disabled: !channel
        },
        "Post poll"
      ))
    );
  }
  function Tally({ message }) {
    if (!message || message.delivery && !["accepted", "seen"].includes(message.delivery)) return null;
    const options = pollChoices(message);
    if (!options.length) return null;
    if (message.edited) {
      return /* @__PURE__ */ React.createElement("p", { style: captionStyle }, "The tally is unavailable after a poll is edited.");
    }
    const { counts, excluded, valid } = countVotes(message.reactions, options);
    return /* @__PURE__ */ React.createElement("div", { style: { ...captionStyle, display: "grid", gap: "var(--space-1)" } }, /* @__PURE__ */ React.createElement("span", null, "Poll tally \xB7 ", valid, " ", valid === 1 ? "vote" : "votes"), /* @__PURE__ */ React.createElement(
      "ul",
      {
        "aria-label": "Votes by option",
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          margin: 0,
          padding: 0,
          listStyle: "none"
        }
      },
      options.map((emoji, index) => /* @__PURE__ */ React.createElement("li", { key: emoji, "aria-label": `Option ${index + 1}, ${counts[index]} ${counts[index] === 1 ? "vote" : "votes"}` }, emoji, " ", counts[index]))
    ), excluded > 0 && /* @__PURE__ */ React.createElement("span", null, excluded, " ", excluded === 1 ? "voter picked" : "voters picked", " multiple choices and will count when only one remains."));
  }
  ctx.panels.register({
    id: "create-poll",
    title: "Create poll",
    matches: () => false,
    channelMenu: { label: "Create poll", eligible: canPost },
    component: PollComposer
  });
  ctx.conversation.registerAccessory({
    id: "tally",
    title: "Poll tally",
    placement: "message",
    component: Tally
  });
};
export {
  apply,
  inject
};
