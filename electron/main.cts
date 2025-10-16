import path from "node:path";
import http from "node:http";
import { parse } from "node:url";
import next from "next";
import { app, BrowserWindow } from "electron";
import { startCatalogServer } from "@jamra/catalog-server";

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

  console.log(`Next.js server listening on http://localhost:${NEXT_PORT}`);
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 720,
    webPreferences: {
      contextIsolation: true,
    },
  });

  await win.loadURL(`http://localhost:${NEXT_PORT}`);

  const gpuStatus = app.getGPUFeatureStatus?.();
  if (gpuStatus) {
    console.log("GPU feature status:", gpuStatus);
  }
}

app.whenReady().then(async () => {
  try {
    const catalogInstance = await startCatalogServer({ port: API_PORT });
    catalogClose = catalogInstance.close;
    await prepareNext();
    await createWindow();
  } catch (error) {
    console.error("Failed to start desktop shell", error);
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

app.on("before-quit", async (event) => {
  if (shuttingDown) {
    return;
  }

  event.preventDefault();
  shuttingDown = true;
  try {
    await catalogClose?.();
  } catch (error) {
    console.error("Failed to close catalog server", error);
  }

  await new Promise<void>((resolve) => {
    if (nextServer) {
      nextServer.close(() => resolve());
    } else {
      resolve();
    }
  });

  app.exit();
});
