const { app, BrowserWindow } = require('electron');
   const path = require('path');

   app.whenReady().then(() => {
     const win = new BrowserWindow({
       width: 1200,
       height: 1080,
       webPreferences: {
         nodeIntegration: true,
         contextIsolation: false
       }
     });
  // Temporarily always load from development server to ensure content is visible
  win.loadURL('http://localhost:3000');
     win.setTitle('Odyssey Desktop - Loading...');
   });

   app.on('window-all-closed', () => {
     if (process.platform !== 'darwin') app.quit();
   });
