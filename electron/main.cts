import path from "node:path";
import http from "node:http";
import { parse } from "node:url";
import next from "next";
import { app, BrowserWindow } from "electron";
import { startCatalogServer } from "@jamra/catalog-server";
import { ElectronLogger } from "./logger-setup.cjs";

if (process.env.NODE_ENV !== "production") {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
}

// Initialize logger
const dataDir = process.env.JAMRA_DATA_DIR ?? path.join(process.cwd(), ".jamra-data");
const logger = new ElectronLogger(dataDir);

// Setup crash handlers
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: String(error),
    stack: error.stack,
    name: error.name,
    message: error.message,
  });
  // Give logger time to flush before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", {
    reason: String(reason),
    promise: String(promise),
  });
});

const NEXT_PORT = Number(process.env.JAMRA_NEXT_PORT ?? 3000);
const API_PORT = Number(process.env.JAMRA_API_PORT ?? 4545);
const isProduction = process.env.NODE_ENV === "production";

// Ensure Chromium re-enables GPU features on Linux where "hover: none" probing breaks animations.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("disable-gpu-sandbox");

process.env.NEXT_PUBLIC_JAMRA_API_URL =
  process.env.NEXT_PUBLIC_JAMRA_API_URL ?? `http://localhost:${API_PORT}/api`;

let nextServer: http.Server | undefined;
let catalogClose: (() => Promise<void>) | undefined;

async function prepareNext(): Promise<void> {
  const dir = path.resolve(process.cwd());
  const nextApp = next({
    dev: !isProduction,
    dir,
  });

  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  nextServer = http.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 404;
      res.end();
      return;
    }

    const parsedUrl = parse(req.url, true);
    void handle(req, res, parsedUrl);
  });

  await new Promise<void>((resolve, reject) => {
    nextServer!.once("error", reject);
    nextServer!.listen(NEXT_PORT, resolve);
  });

  logger.info(`Next.js server listening on http://localhost:${NEXT_PORT}`);
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1200,
    minHeight: 720,
    webPreferences: {
      contextIsolation: true,
    },
  });

  await win.loadURL(`http://localhost:${NEXT_PORT}`);

  const gpuStatus = app.getGPUFeatureStatus?.();
  if (gpuStatus) {
    logger.debug("GPU feature status", gpuStatus);
  }
}

app.whenReady().then(async () => {
  try {
    logger.info("Electron app starting", { port: API_PORT, nodeEnv: process.env.NODE_ENV });
    const catalogInstance = await startCatalogServer({ port: API_PORT });
    catalogClose = catalogInstance.close;
    logger.info("Catalog server started");
    await prepareNext();
    logger.info("Next.js server prepared");
    await createWindow();
    logger.info("Main window created");
  } catch (error) {
    logger.error("Failed to start desktop shell", { error: String(error), stack: (error as Error).stack });
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let shuttingDown = false;

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("Shutting down application", {
    catalogServer: !!catalogClose,
    nextServer: !!nextServer,
  });

  // Set a timeout to force exit if shutdown hangs
  const forceExitTimeout = setTimeout(() => {
    console.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 10000); // 10 seconds

  try {
    try {
      await catalogClose?.();
      logger.info("Catalog server closed");
    } catch (error) {
      logger.error("Failed to close catalog server", { error: String(error) });
    }

    await new Promise<void>((resolve) => {
      if (nextServer) {
        nextServer.close(() => {
          logger.info("Next.js server closed");
          resolve();
        });
      } else {
        resolve();
      }
    });

    // Close logger and flush remaining logs
    try {
      await logger.close();
    } catch (error) {
      console.error("Failed to close logger:", error);
    }
  } catch (error) {
    console.error("Unexpected error during shutdown:", error);
  } finally {
    clearTimeout(forceExitTimeout);
    process.exit(exitCode);
  }
}

// Handle application-level quit events (Cmd+Q, etc.)
app.on("before-quit", async (event) => {
  if (!shuttingDown) {
    event.preventDefault();
    await shutdown(0);
  }
});

// Handle process signals (Ctrl+C, kill, etc.)
process.on("SIGINT", async () => {
  console.log("Received SIGINT");
  await shutdown(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM");
  await shutdown(0);
});
