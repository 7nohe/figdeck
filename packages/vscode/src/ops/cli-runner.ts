import { type ChildProcess, spawn } from "node:child_process";

/**
 * Result of CLI detection
 */
export interface CliDetectionResult {
  found: boolean;
  command: string[];
  source: "workspace" | "path" | "config" | "none";
}

/**
 * Options for running CLI commands
 */
export interface RunCliOptions {
  args: string[];
  cwd?: string;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number | null) => void;
  onError?: (error: Error) => void;
}

function formatCliCommand(cmd: string, args: string[]): string {
  return [cmd, ...args]
    .map((part) => (/[^\w@%+=:,./-]/u.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function toSpawnError(error: unknown, cmd: string, args: string[]): Error {
  const command = formatCliCommand(cmd, args);

  if (error instanceof Error) {
    return new Error(
      `Failed to spawn figdeck CLI (${command}): ${error.message}`,
      {
        cause: error,
      },
    );
  }

  return new Error(`Failed to spawn figdeck CLI (${command})`);
}

/**
 * Run a figdeck CLI command
 */
export async function runCli(
  cliResult: CliDetectionResult,
  options: RunCliOptions,
): Promise<ChildProcess> {
  if (!cliResult.found) {
    throw new Error("figdeck CLI not found");
  }

  const [cmd, ...baseArgs] = cliResult.command;
  const args = [...baseArgs, ...options.args];

  let proc: ChildProcess;
  try {
    proc = spawn(cmd, args, {
      cwd: options.cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw toSpawnError(error, cmd, args);
  }

  const spawned = new Promise<void>((resolve, reject) => {
    const onSpawn = () => {
      proc.off("error", onError);
      resolve();
    };

    const onError = (error: Error) => {
      proc.off("spawn", onSpawn);
      reject(toSpawnError(error, cmd, args));
    };

    proc.once("spawn", onSpawn);
    proc.once("error", onError);
  });

  // Handle spawn errors to avoid crashing the extension host.
  proc.on("error", (error) => {
    options.onError?.(error);
  });

  if (options.onStdout && proc.stdout) {
    proc.stdout.on("data", (data: Buffer) => {
      options.onStdout?.(data.toString());
    });
  }

  if (options.onStderr && proc.stderr) {
    proc.stderr.on("data", (data: Buffer) => {
      options.onStderr?.(data.toString());
    });
  }

  if (options.onExit) {
    proc.on("exit", options.onExit);
  }

  // Wait until the process is successfully spawned, or surface spawn errors to callers.
  await spawned;

  return proc;
}

