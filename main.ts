import { app, BrowserWindow, IpcMain, ipcMain } from 'electron'
import dbm from './db'
import sqlite3 from 'sqlite3'

const dbmShedule: Function[] = []

function createWindow() {
    let win: BrowserWindow | null = new BrowserWindow({
        width: 350,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        },
        frame: false,
        icon: "./timer.png"
    })
    win.loadFile("./front/index.html")
    win.on('closed', () => {
        win = null;
    })
}


app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
    db.close();
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
let db: sqlite3.Database;
const getDB = async () => { if (db === undefined) { db = await dbm.init() } return db; }

ipcMain.on('getTimersReq', async event => {
    scheduleDBMCommand(async (db: sqlite3.Database) => {
        return await dbm.getTimers(db);
    }, (res: TimerData[]) => {
        event.sender.send("getTimersRes", res);
    }, await getDB());
});

ipcMain.on('addTimersReq', async (event, ...args: TimerData[]) => {
    scheduleDBMCommand(async (db: sqlite3.Database, ...timers: TimerData[]) => {
        return await dbm.addTimers(db, ...timers);
    }, () => {
        event.sender.send("addTimersRes");
    }, await getDB(), ...args)
});

ipcMain.on('removeTimersReq', async (event, ...args: TimerData[]) => {
    scheduleDBMCommand(async (db: sqlite3.Database, ...timers: TimerData[]) => {
        return await dbm.removeTimers(db, ...timers);
    }, () => {
        event.sender.send("removeTimersRes");
    }, await getDB(), ...args)
});



function scheduleDBMCommand(func: Function, cb: Function, ...args: any[]) {
    const l = dbmShedule.length;
    const f = async (i: number, decr: boolean) => {
        let ii = i;
        if (decr) {
            ///@ts-ignore
            dbmShedule[i - 1].i = i - 1;
            ii = i - 1;
        }
        if (i === 0) {
            ///@ts-expect-error
            dbmShedule[ii].e = true;
            cb(await func(...args));
            dbmShedule.shift();
            for (let i of dbmShedule) {
                ///@ts-ignore
                i(i.i, true);
            }
            updateShedule();
        }
    }
    f.e = false;
    f.i = l;
    dbmShedule.push(f);
    updateShedule();
}

function updateShedule() {
    if (dbmShedule.length > 0) {
        ///@ts-ignore
        if (!dbmShedule[0].e) {
            ///@ts-ignore
            dbmShedule[0](dbmShedule[0].i, false);
        }
    }
}