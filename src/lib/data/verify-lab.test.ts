import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

// An executable check of local-cluster-lab/verify-lab.sh's metrics-pipeline probes: the
// string-only assertions in labs.test.ts would not have caught the curl URL-globbing bug
// (raw PromQL braces in the query string made curl exit 22 and the check always report
// "target down").

const scriptPath = join(process.cwd(), "local-cluster-lab/verify-lab.sh");
const script = readFileSync(scriptPath, "utf8");

// The script's curl calls hardcode these ports; the mocks must bind them exactly.
const EXPORTER_PORT = 9308;
const PROM_PORT = 9090;

const promBody = JSON.stringify({
  status: "success",
  data: {
    resultType: "vector",
    result: [{ metric: { __name__: "up", job: "kafka-exporter" }, value: [1_706_000_000.123, "1"] }],
  },
});

function startServer(port: number, handler: http.RequestListener): Promise<http.Server | null> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.once("error", () => resolve(null)); // port busy / not permitted → skip
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function toolPresent(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, { stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

describe("verify-lab.sh — metrics pipeline probe", () => {
  let servers: http.Server[] = [];
  let ready = false;

  beforeAll(async () => {
    if (!toolPresent("curl", ["--version"])) return;
    if (!toolPresent("docker", ["compose", "version"])) return;
    const exporter = await startServer(EXPORTER_PORT, (_req, res) => {
      res.setHeader("content-type", "text/plain");
      res.end("# HELP kafka_brokers Number of Brokers\nkafka_brokers 3\n");
    });
    const prom = await startServer(PROM_PORT, (req, res) => {
      // Behave like Prometheus: only answer the correctly-encoded query. A URL that smuggled
      // raw `up{job="kafka-exporter"}` through curl's glob handling arrives mangled → 400.
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${PROM_PORT}`);
      if (url.pathname === "/api/v1/query" && url.searchParams.get("query") === 'up{job="kafka-exporter"}') {
        res.setHeader("content-type", "application/json");
        res.end(promBody);
      } else {
        res.statusCode = 400;
        res.end('{"status":"error","errorType":"bad_data"}');
      }
    });
    servers = [exporter, prom].filter((s): s is http.Server => s !== null);
    ready = servers.length === 2;
    if (!ready) servers.forEach((s) => s.close());
  });

  afterAll(() => servers.forEach((s) => s.close()));

  it("builds the Prometheus query with --data-urlencode, not raw braces in the URL", () => {
    // raw `.../query?query=up{...}` triggers curl's {} glob syntax → exit 22, always "down"
    expect(script).not.toMatch(/\/api\/v1\/query\?query=/);
    expect(script).toMatch(/--data-urlencode 'query=up\{job="kafka-exporter"\}'/);
  });

  it("reports the exporter metric and the Prometheus scrape as healthy when both respond", async (ctx) => {
    if (!ready) ctx.skip();
    let out = "";
    try {
      // async so this worker's event loop stays free to serve the mock HTTP responses
      const r = await execFileAsync("bash", [scriptPath], { encoding: "utf8", timeout: 30_000 });
      out = r.stdout;
    } catch (e) {
      // The brokers aren't running, so the script exits 1 — its stdout is what we assert on.
      out = (e as { stdout?: string }).stdout ?? "";
    }
    expect(out).toMatch(/✓ kafka-exporter is producing kafka_\* metrics/);
    expect(out).toMatch(/✓ Prometheus is scraping kafka-exporter/);
    expect(out).not.toMatch(/✗ Prometheus is not scraping/);
  });
});
