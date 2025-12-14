import { describe, expect, it } from "bun:test";
import { type CliDetectionResult, runCli } from "./cli-runner";

describe("runCli", () => {
  it("streams stdout/stderr and reports exit code", async () => {
    const cliResult: CliDetectionResult = {
      found: true,
      command: [process.execPath],
      source: "config",
    };

    let stdout = "";
    let stderr = "";
    let exitCode: number | null | undefined;

    const proc = await runCli(cliResult, {
      args: ["-e", "console.log('out'); console.error('err');"],
      onStdout: (data) => {
        stdout += data;
      },
      onStderr: (data) => {
        stderr += data;
      },
      onExit: (code) => {
        exitCode = code;
      },
    });

    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("out");
    expect(stderr).toContain("err");
  });

  it("rejects on spawn error (ENOENT) without crashing", async () => {
    if (process.platform === "win32") return;

    const cliResult: CliDetectionResult = {
      found: true,
      command: [`definitely-not-a-command-${Date.now()}`],
      source: "config",
    };

    let errorFromCallback: Error | null = null;
    let caught: Error | null = null;

    try {
      await runCli(cliResult, {
        args: [],
        onError: (error) => {
          errorFromCallback = error;
        },
      });
    } catch (error) {
      caught = error as Error;
    }

    expect(errorFromCallback).not.toBe(null);
    expect(caught).not.toBe(null);
    expect(caught?.message).toContain("Failed to spawn figdeck CLI");
  });
});
