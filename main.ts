import { app, BrowserWindow, IpcMain, ipcMain } from 'electron'
import dbm from './db'
import sqlite3 from 'sqlite3'
import path from 'path'

const dbmShedule: SheduleFunction[] = []

function createWindow() {
    let win: BrowserWindow | null = new BrowserWindow({
        width: 350,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        },
        frame: false,
        icon: path.join(__dirname, "./timer.png")
    })
    win.loadFile(path.join(__dirname, "./front/index.html"))
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
    scheduleCommand(async (db: sqlite3.Database) => {
        return await dbm.getTimers(db);
    }, (res: TimerData[]) => {
        event.sender.send("getTimersRes", res);
    }, await getDB());
});

ipcMain.on('addTimersReq', async (event, ...args: TimerData[]) => {
    scheduleCommand(async (db: sqlite3.Database, ...timers: TimerData[]) => {
        return await dbm.addTimers(db, ...timers);
    }, () => {
        event.sender.send("addTimersRes");
    }, await getDB(), ...args)
});

ipcMain.on('editTimersReq', async (event, ...args: TimerData[]) => {
    scheduleCommand(async (db: sqlite3.Database, ...timers: TimerData[]) => {
        return await dbm.addTimers(db, ...timers);
    }, () => {
        event.sender.send("editTimersRes");
    }, await getDB(), ...args)
});

ipcMain.on('removeTimersReq', async (event, ...args: TimerData[]) => {
    scheduleCommand(async (db: sqlite3.Database, ...timers: TimerData[]) => {
        return await dbm.removeTimers(db, ...timers);
    }, () => {
        event.sender.send("removeTimersRes");
    }, await getDB(), ...args)
});

interface SheduleFunction extends Function {
    index: number,
    running: boolean
}

function scheduleCommand(func: Function, cb: Function, ...args: any[]) {
    const l = dbmShedule.length;
    //casting to unknown here because i needed to store some data with the function and decided to set them as a property of said function
    const f: SheduleFunction = <SheduleFunction><unknown>(async (i: number, decr: boolean) => {
        let ii = i;
        if (decr) {
            dbmShedule[i - 1].index = i - 1;
            ii = i - 1;
        }
        if (i === 0) {
            ///@ts-expect-error
            dbmShedule[ii].e = true;
            cb(await func(...args));
            dbmShedule.shift();
            for (let i of dbmShedule) {
                i(i.index, true);
            }
            updateShedule();
        }
    })
    f.running = false;
    f.index = l;
    dbmShedule.push(f);
    updateShedule();
}

function updateShedule() {
    if (dbmShedule.length > 0) {
        if (!dbmShedule[0].running) {
            dbmShedule[0](dbmShedule[0].index, false);
        }
    }
}
