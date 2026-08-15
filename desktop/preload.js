const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
