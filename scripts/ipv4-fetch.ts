import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const ipv4HttpsAgent = new https.Agent({ family: 4, keepAlive: true });
const ipv4HttpAgent = new http.Agent({ family: 4, keepAlive: true });

function headerObject(headers?: HeadersInit): http.OutgoingHttpHeaders {
  if (!headers) return {};
  return Object.fromEntries(new Headers(headers).entries());
}

export function formatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const extras: string[] = [err.message];
  const withCode = err as Error & { code?: string; cause?: unknown };
  if (withCode.code) extras.push(`code=${withCode.code}`);
  let current: unknown = withCode.cause;
  let depth = 0;
  while (current && depth < 5) {
    if (current instanceof Error) {
      const code = (current as Error & { code?: string }).code;
      extras.push(code ? `${current.message} (${code})` : current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      extras.push(String(current));
      break;
    }
    depth += 1;
  }
  return extras.join(" → ");
}

/** Node https/http request with IPv4 only — avoids Undici "fetch failed" on Windows. */
export function ipv4Fetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? String(input) : input.url,
  );
  const isHttps = url.protocol === "https:";
  const method = init?.method ?? "GET";
  const headers = headerObject(init?.headers);
  const body = init?.body;

  return new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(
      url,
      {
        method,
        headers,
        agent: isHttps ? ipv4HttpsAgent : ipv4HttpAgent,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value == null) continue;
            responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
          }
          resolve(
            new Response(buf, {
              status: res.statusCode ?? 500,
              statusText: res.statusMessage,
              headers: responseHeaders,
            }),
          );
        });
      },
    );
    req.setTimeout(30_000, () => {
      req.destroy(new Error("IPv4 request timed out after 30s"));
    });
    req.on("error", reject);
    if (body == null) {
      req.end();
      return;
    }
    if (typeof body === "string" || Buffer.isBuffer(body)) {
      req.end(body);
      return;
    }
    reject(new Error(`Unsupported request body type: ${typeof body}`));
  });
}

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
