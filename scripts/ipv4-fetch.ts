export { formatError, ipv4Fetch } from "../lib/ipv4-fetch";

import https from "node:https";
import { URL } from "node:url";

const ipv4HttpsAgent = new https.Agent({ family: 4, keepAlive: true });

export function probeHttps(origin: string): Promise<string> {
  const url = new URL("/", origin);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: "HEAD", agent: ipv4HttpsAgent, family: 4, timeout: 15_000 },
      (res) => {
        res.resume();
        resolve(`HEAD ${url.host} → ${res.statusCode}`);
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("probe timed out")));
    req.end();
  });
}
