import { spawn } from "node:child_process";

type Instruction = {
  cmd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
};

const SHELL = process.platform === "win32";

const PACKAGE_ORDER = [
  "@jamra/extension-sdk",
  "@jamra/extension-registry",
  "@jamra/catalog-db",
  "@jamra/extension-host",
  "@jamra/catalog-service",
  "@jamra/offline-storage",
  "@jamra/catalog-server",
  "@jamra/example-extension",
  "@jamra/weebcentral-extension",
];

function runCommand(instruction: Instruction): Promise<void> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ...instruction.env };
    for (const key of Object.keys(env)) {
      if (env[key] === undefined) {
        delete env[key];
      }
    }

    const child = spawn(instruction.cmd, instruction.args, {
      stdio: "inherit",
      shell: SHELL,
      env,
    });

    child.on("error", (error) => reject(error));

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(
          new Error(`${instruction.cmd} terminated with signal ${signal}`),
        );
      } else if (code && code !== 0) {
        reject(
          new Error(
            `${instruction.cmd} ${instruction.args.join(" ")} exited with code ${code}`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

async function runSequential(instructions: Instruction[]): Promise<void> {
  for (const instruction of instructions) {
    await runCommand(instruction);
  }
}

function runConcurrent(instructions: Instruction[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const processes = instructions.map((instruction) => {
      const env: NodeJS.ProcessEnv = { ...process.env, ...instruction.env };
      for (const key of Object.keys(env)) {
        if (env[key] === undefined) {
          delete env[key];
        }
      }

      const child = spawn(instruction.cmd, instruction.args, {
        stdio: "inherit",
        shell: SHELL,
        env,
      });
      return { instruction, child };
    });

    let settled = false;
    let remaining = processes.length;

    const stopListeners = () => {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    };

    const terminateChildren = () => {
      processes.forEach(({ child }) => {
        if (!child.killed) {
          child.kill("SIGTERM");
        }
      });
    };

    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      stopListeners();
      resolve();
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      terminateChildren();
      stopListeners();
      reject(error);
    };

    const onSigint = () => {
      terminateChildren();
      resolveOnce();
    };
    const onSigterm = () => {
      terminateChildren();
      resolveOnce();
    };

    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);

    processes.forEach(({ child, instruction }) => {
      child.on("error", (error) => {
        rejectOnce(error instanceof Error ? error : new Error(String(error)));
      });
      child.on("exit", (code, signal) => {
        if (settled) {
          return;
        }

        if (signal || (code && code !== 0)) {
          rejectOnce(
            new Error(
              `${instruction.cmd} ${instruction.args.join(" ")} exited` +
                (signal ? ` with signal ${signal}` : ` with code ${code}`),
            ),
          );
          return;
        }

        remaining -= 1;
        if (remaining === 0) {
          resolveOnce();
        }
      });
    });
  });
}

async function forceBuildPackage(pkg: string): Promise<void> {
  // Clean incremental cache and dist to force fresh build
  await runCommand({
    cmd: "pnpm",
    args: [
      "--filter",
      pkg,
      "exec",
      "rm",
      "-rf",
      "tsconfig.tsbuildinfo",
      "dist",
    ],
  });
  await runCommand({
    cmd: "pnpm",
    args: ["--filter", pkg, "build"],
  });
}

async function buildBackend(): Promise<void> {
  // Phase 1: Build foundation packages in parallel (no internal dependencies)
  await runConcurrent([
    { cmd: "pnpm", args: ["--filter", "@jamra/extension-sdk", "build"] },
    { cmd: "pnpm", args: ["--filter", "@jamra/extension-registry", "build"] },
  ]);

  // Phase 2: Build packages that depend on phase 1 (parallel)
  await runConcurrent([
    { cmd: "pnpm", args: ["--filter", "@jamra/catalog-db", "build"] },
    { cmd: "pnpm", args: ["--filter", "@jamra/extension-host", "build"] },
  ]);

  // Phase 3: Build catalog-service (depends on extension-host)
  await runCommand({
    cmd: "pnpm",
    args: ["--filter", "@jamra/catalog-service", "build"],
  });

  // Phase 4: Build offline-storage (depends on catalog-service)
  await runCommand({
    cmd: "pnpm",
    args: ["--filter", "@jamra/offline-storage", "build"],
  });

  // Phase 5: Force rebuild catalog-server (critical - always fresh)
  await forceBuildPackage("@jamra/catalog-server");

  // Phase 6: Build extensions in parallel (only need extension-sdk from phase 1)
  await runConcurrent([
    { cmd: "pnpm", args: ["--filter", "@jamra/example-extension", "build"] },
    {
      cmd: "pnpm",
      args: ["--filter", "@jamra/weebcentral-extension", "build"],
    },
  ]);
}

async function buildElectronMain(): Promise<void> {
  await runCommand({
    cmd: "pnpm",
    args: ["exec", "tsc", "-p", "electron/tsconfig.json"],
  });
}

async function buildWeb(): Promise<void> {
  await runCommand({ cmd: "pnpm", args: ["exec", "next", "build"] });
}

async function startApi(): Promise<void> {
  await runCommand({
    cmd: "node",
    args: ["packages/catalog-server/dist/index.js"],
  });
}

function printHelp(): void {
  console.log(`Usage: pnpm run run <command> [subcommand]

Commands:
  bootstrap next            Start Next.js dev server only.
  bootstrap api             Build backend packages and start the catalog API.
  bootstrap web             Build backend packages, start API + Next.js dev together.
  bootstrap desktop         Build backend packages and launch the Electron shell.

  build backend             Build all backend packages (extensions, catalog, server).
  build web                 Build the Next.js application.
  build all                 Build backend packages and the Next.js app.

  start api                 Start the catalog API from the compiled output.
  start web                 Start the Next.js production server.
  start all                 Start both API and Next.js (production).

  packages <script> [...]    Run an npm script across all backend packages sequentially.
  smoke                      Run the extension host smoke test.
  help                       Show this message.
`);
}

async function main(): Promise<void> {
  const [, , command, subcommand, ...rest] = process.argv;

  switch (command) {
    case "bootstrap":
      switch (subcommand) {
        case "next":
          await runCommand({ cmd: "pnpm", args: ["exec", "next", "dev"] });
          break;
        case "api":
          await buildBackend();
          await runCommand({
            cmd: "pnpm",
            args: ["exec", "tsx", "packages/catalog-server/src/server.ts"],
          });
          break;
        case "web":
          await buildBackend();
          await runConcurrent([
            {
              cmd: "pnpm",
              args: ["exec", "tsx", "packages/catalog-server/src/server.ts"],
            },
            { cmd: "pnpm", args: ["exec", "next", "dev"] },
          ]);
          break;
        case "desktop":
          await buildBackend();
          await buildElectronMain();
          await runCommand({
            cmd: "pnpm",
            args: ["exec", "electron", "electron/dist/main.cjs"],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
          });
          break;
        default:
          printHelp();
          process.exit(1);
      }
      break;
    case "build":
      switch (subcommand) {
        case "backend":
          await buildBackend();
          break;
        case "web":
          await buildWeb();
          break;
        case "all":
          await buildBackend();
          await buildWeb();
          break;
        default:
          printHelp();
          process.exit(1);
      }
      break;
    case "start":
      switch (subcommand) {
        case "api":
          await buildBackend();
          await startApi();
          break;
        case "web":
          await runCommand({ cmd: "pnpm", args: ["exec", "next", "start"] });
          break;
        case "all":
          await buildBackend();
          await runConcurrent([
            { cmd: "node", args: ["packages/catalog-server/dist/index.js"] },
            { cmd: "pnpm", args: ["exec", "next", "start"] },
          ]);
          break;
        default:
          printHelp();
          process.exit(1);
      }
      break;
    case "packages": {
      const script = subcommand;
      if (!script) {
        printHelp();
        process.exit(1);
      }
      const extraArgs = rest;
      await runSequential(
        PACKAGE_ORDER.map((pkg) => ({
          cmd: "pnpm",
          args: ["--filter", pkg, script, ...extraArgs],
        })),
      );
      break;
    }
    case "smoke":
      await runCommand({
        cmd: "node",
        args: ["scripts/run-example-extension.mjs"],
      });
      break;
    case "help":
    case undefined:
      printHelp();
      break;
    default:
      printHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
