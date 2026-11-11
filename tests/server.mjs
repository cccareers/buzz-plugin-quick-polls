import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
await build({
  entryPoints: ["tests/fixture/host.tsx"],
  outfile: "tests/.generated/host.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["/plugin.js"],
});
const assets = new Map([
  ["/host.js", ["tests/.generated/host.js", "text/javascript"]],
  ["/plugin.js", ["plugin.js", "text/javascript"]],
]);
createServer(async (req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html><body><main><div id="composer"></div><div id="tally"></div></main><script type="module" src="/host.js"></script></body></html>',
    );
    return;
  }
  const asset = assets.get(req.url);
  if (!asset) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    res.setHeader("Content-Type", asset[1]);
    res.end(await readFile(asset[0]));
  } catch {
    res.writeHead(500);
    res.end();
  }
}).listen(4187, "127.0.0.1");
