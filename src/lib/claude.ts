import { spawn } from "child_process";

export function runClaudeCommand(prompt: string, input: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", prompt], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = <T>(fn: (value: T) => void, value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn(value);
    };

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      settle(reject, new Error("Request timed out - code may be too complex"));
    }, timeout);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        settle(resolve, stdout.trim());
      } else {
        settle(reject, new Error(stderr || `Process exited with code ${exitCode}`));
      }
    });

    child.on("error", (err) => {
      settle(reject, err);
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}
