const { spawn } = require("node:child_process");
const os = require("node:os");

class CodexUsageClient {
  constructor(executable, callbacks) {
    this.executable = executable;
    this.callbacks = callbacks;
    this.child = undefined;
    this.buffer = "";
    this.nextId = 0;
    this.pending = new Map();
    this.refreshTimer = undefined;
    this.refreshInProgress = false;
    this.disposed = false;
  }

  async start() {
    this.child = spawn(this.executable, ["app-server", "--listen", "stdio://"], {
      cwd: os.homedir(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.handleOutput(chunk));
    this.child.stderr.on("data", () => {});
    this.child.on("error", () => this.failPendingRequests(new Error("Codex app-server failed")));
    this.child.on("exit", () => {
      this.failPendingRequests(new Error("Codex app-server stopped"));
      if (!this.disposed) this.callbacks.onExit();
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex-usage-monitor",
        title: "Codex Usage Monitor",
        version: "0.0.1"
      }
    });
    this.writeMessage({ method: "initialized", params: {} });

    this.refreshTimer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    await this.refresh();
  }

  async refresh() {
    if (this.disposed || this.refreshInProgress || !this.child) return;
    this.refreshInProgress = true;

    try {
      const response = await this.request("account/rateLimits/read", {
        excludeResetCreditDetails: true
      });
      this.callbacks.onUsage(response);
    } catch {
      this.callbacks.onUnavailable();
    } finally {
      this.refreshInProgress = false;
    }
  }

  request(method, params) {
    const id = ++this.nextId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Codex app-server request timed out"));
      }, 20_000);

      this.pending.set(id, { resolve, reject, timeout });

      try {
        this.writeMessage({ id, method, params });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  writeMessage(message) {
    if (!this.child?.stdin.writable) throw new Error("Codex app-server is not available");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  handleOutput(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      if (message.method === "account/rateLimits/updated") {
        this.refresh();
        continue;
      }

      const pending = this.pending.get(message.id);
      if (!pending) continue;

      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error("Codex app-server request failed"));
      else pending.resolve(message.result);
    }
  }

  failPendingRequests(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  dispose() {
    this.disposed = true;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
    this.failPendingRequests(new Error("Codex usage monitor stopped"));
    this.child?.kill();
    this.child = undefined;
  }
}

const POLL_INTERVAL_MS = 20_000;

module.exports = {
  CodexUsageClient
};
