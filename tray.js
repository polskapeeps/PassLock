const { Tray, Menu } = require('electron');
const path = require('path');

let tray = null;

function createTray(mainWindow) {
    tray = new Tray(path.join(__dirname, 'build/icon.ico'));    const contextMenu = Menu.buildFromTemplate([
        { Label: 'Passlock 1.0', 
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'Quit',
            click: () => {
                require('electron').app.quit();
            }
        }
    ]);

    tray.setToolTip('PassLock');
    tray.setContextMenu(contextMenu);

    tray.setVisible(true);

    return tray.setVisible(true);

}

module.exports = createTray;
  