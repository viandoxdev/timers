import sql from 'sqlite3'
import path from 'path'

interface TimerData {
    id: string,
    endDate: number,
    name: string,
    notSent: boolean
}
async function init(): Promise<sql.Database> {
    const db = await sqlDatabase(path.join(__dirname, '/timers.db'));
    await run(db,
        `CREATE TABLE "timers" (
    "id"	TEXT NOT NULL UNIQUE,
    "endDate"	INTEGER NOT NULL,
    "name"	TEXT NOT NULL,
    "notSent"	INTEGER NOT NULL,
    PRIMARY KEY("id")
);`
    );

    return db;
}
function sqlDatabase(filename: string): Promise<sql.Database> {
    return new Promise((res, rej) => {
        const ret = new sql.Database(filename, (err: any) => {
            if (!err === null) {
                rej(err);
            } else {
                res(ret);
            }
        })
    })
}

function run(db: sql.Database, sql: string, ...params: any[]) {
    return new Promise((res, rej) => {
        const ret = db.run(sql, ...params, (err: Error) => {
            if (!err === null) {
                rej(err);
            } else {
                res(ret);
            }
        })
    });
}

function each(db: sql.Database, sql: string, callBack?: ((this: sql.Statement, err: Error | null, row: any) => void)) {
    return new Promise((res, rej) => {
        const ret = db.each(sql, callBack, err => {
            if (!err === null) {
                rej(err);
            } else {
                res(ret);
            }
        })
    })
}


async function getTimers(db: sql.Database) {
    const res: TimerData[] = [];
    await each(db, "SELECT * FROM timers", (err, row) => {
        res.push({
            id: row.id,
            name: row.name,
            endDate: row.endDate * 1000,
            notSent: row.notSent === 1
        });
    });
    return res;
}

async function addTimers(db: sql.Database, ...timers: TimerData[]) {
    const existingTimersIds = (await getTimers(db)).map(v => v.id);
    for (let i of timers) {
        let found = false
        for (let j of existingTimersIds) {
            if (i.id === j) found = true;
        }
        if (!found) {
            await run(db, "INSERT INTO timers VALUES(?,?,?,?)", i.id, Math.floor(i.endDate / 1000), i.name, i.notSent ? 1 : 0);
        }
    }
}

async function removeTimers(db: sql.Database, ...timers: TimerData[] | string[]) {
    /// @ts-expect-error
    for (let i of (timers.every((v: TimerData | string) => typeof v === "string") ? timers : timers.map((v: TimerData) => v.id))) {
        await run(db, "DELETE FROM timers WHERE id = ?", i);
    }
}

export default {
    init: init,
    getTimers: getTimers,
    addTimers: addTimers,
    removeTimers: removeTimers
}