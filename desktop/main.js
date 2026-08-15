const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: "#0f172a",
      title: "Sysnnova",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    win.loadFile(path.join(__dirname, "web", "index.html"));

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });

    win.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("file://")) event.preventDefault();
    });

    win.on("page-title-updated", (event) => event.preventDefault());
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      app.emit("ready");
    }
  });
}
