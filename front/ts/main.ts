///<reference path="../../node_modules/electron/electron.d.ts" />
///<reference path="../../types.d.ts" />
const { BrowserWindow, remote, ipcRenderer } = require("electron");

const win = <() => Electron.BrowserWindow>remote.BrowserWindow.getFocusedWindow;

const navBar = {
    close: <HTMLElement>document.getElementById("nav_close_button"),
    min: <HTMLElement>document.getElementById("nav_min_button"),
    max: <HTMLElement>document.getElementById("nav_max_button"),
    maxIcon: <HTMLElement>document.getElementById("nav_max_icon")
}

const timerNameInput = <HTMLInputElement>document.querySelector("#bottom input.timer_name");
const timerEndInput = <HTMLInputElement>document.querySelector("#bottom input.timer_time");
const timerHourInput = <HTMLInputElement>document.querySelector("#bottom input.timer_delay");
const timerNewButton = <HTMLButtonElement>document.querySelector("#addButton");
const timerDelbutton = <HTMLButtonElement>document.querySelector("#deleteAll");

const loadingBar = <HTMLDivElement>document.querySelector("#load");
var priority = true;

ipcRenderer.on("getTimersRes", (event, args: TimerData[]) => {
    loadingBar.remove();
    for (let i of args) {
        const t = new Timer(new Date(i.endDate), i.name, i.id, new Date(i.creationDate), false);
        t.notificationSent = true;
    }
});

ipcRenderer.send("getTimersReq");

navBar.close.addEventListener('click', e => {
    win().close();
});
navBar.min.addEventListener('click', e => {
    win().minimize();
});
navBar.max.addEventListener('click', e => {
    if (win().isMaximized()) {
        win().unmaximize();
    } else {
        win().maximize();
    }
});
window.addEventListener('resize', e => {
    if (win().isMaximized()) {
        navBar.maxIcon.classList.remove("max_1");
        navBar.maxIcon.classList.add("max_2");
    } else {
        navBar.maxIcon.classList.remove("max_2");
        navBar.maxIcon.classList.add("max_1");
    }
});


const bottomDiv = <HTMLDivElement>document.querySelector('#bottom');
const bhead = <HTMLDivElement>document.querySelector('#Bhead');

bhead.addEventListener("click", e => {
    if (bottomDiv.classList.contains("BUp")) {
        bottomDiv.classList.remove("BUp")
        bottomDiv.classList.add("BDown")
        bhead.innerHTML = "︿"
    } else {
        bottomDiv.classList.remove("BDown")
        bottomDiv.classList.add("BUp")
        bhead.innerHTML = "﹀"
    }
});

class Timer {
    static TimersList: Timer[] = [];
    static TimerParentElements = <HTMLDivElement>document.querySelector("#timers_container")
    static looping: boolean = true;
    static sortMethod: "id" | "name" | "date" | "remainingTime" = "remainingTime";
    static reverseSort: boolean = false;
    endDate: Date;
    DOMEls: {
        TimerElement: HTMLDivElement,
        TimeElement: HTMLDivElement,
        TextElement: HTMLDivElement,
        NameElement: HTMLDivElement,
        DelayElement: HTMLDivElement,
        DeleteElement: HTMLDivElement,
        ResetElement: HTMLDivElement
    };
    name: string;
    id: string;
    notificationSent: boolean = false;
    creationDate: Date;
    constructor(completionDate: Date, name: string, id?: string, creationDate = new Date(), db = true) {
        this.name = name
        this.endDate = completionDate;
        this.creationDate = creationDate
        // because im using the downloaded browser side version to work offline
        /// @ts-expect-error
        if (id === undefined) this.id = uuidv4();
        else this.id = id;
        {
            const div = () => document.createElement('div');
            this.DOMEls = {
                TimerElement: div(),
                TimeElement: div(),
                TextElement: div(),
                NameElement: div(),
                DelayElement: div(),
                DeleteElement: div(),
                ResetElement: div(),
            }
            this.DOMEls.TimerElement.classList.add("timer");
            this.DOMEls.TimeElement.classList.add("timer_time");
            this.DOMEls.TextElement.classList.add("timer_text");
            this.DOMEls.NameElement.classList.add("timer_name");
            this.DOMEls.DelayElement.classList.add("timer_delay");
            this.DOMEls.DeleteElement.classList.add("timer_delete");
            this.DOMEls.ResetElement.classList.add("timer_reset");
            this.DOMEls.TimeElement.innerHTML = "00:00"
            this.DOMEls.DelayElement.innerHTML = "00:00"
            this.DOMEls.NameElement.innerHTML = name
            this.DOMEls.TextElement.appendChild(this.DOMEls.NameElement);
            this.DOMEls.TextElement.appendChild(this.DOMEls.DelayElement);
            this.DOMEls.TimerElement.appendChild(this.DOMEls.TimeElement);
            this.DOMEls.TimerElement.appendChild(this.DOMEls.TextElement);
            this.DOMEls.TimerElement.appendChild(this.DOMEls.ResetElement);
            this.DOMEls.TimerElement.appendChild(this.DOMEls.DeleteElement);
            Timer.TimerParentElements.appendChild(this.DOMEls.TimerElement);
            this.DOMEls.DeleteElement.addEventListener('click', this.delete.bind(this));
            this.DOMEls.ResetElement.addEventListener('click', this.reset.bind(this));
            Timer.TimersList.push(this);
            requestAnimationFrame(() => {
                this.DOMEls.TimerElement.style.opacity = "0";
                this.DOMEls.TimerElement.style.transition = "all 0s";
                requestAnimationFrame(() => {
                    this.DOMEls.TimerElement.style.opacity = "1";
                    this.DOMEls.TimerElement.style.transition = "all 0.2s";
                });
            });
        }
        if (db) {
            ipcRenderer.send("addTimersReq", this.toTimerData());
        }
        Timer.sort();
    }

    reset() {
        const dif = this.endDate.getTime() - this.creationDate.getTime();
        this.endDate = new Date(new Date().getTime() + dif);
        this.creationDate = new Date();
        ipcRenderer.send("editTimersReq", this.toTimerData());
        Timer.sort();
    }

    static sort() {
        const sortParentEl = this.TimerParentElements;
        const sortedTimerObject = this.TimersList.sort(this.getSortfunction());
        const oldsYs: number[] = sortedTimerObject.map(v => v.DOMEls.TimerElement.getBoundingClientRect().top);
        let tmp: HTMLDivElement[] = sortedTimerObject.map(v => v.DOMEls.TimerElement);
        const sortEls = this.reverseSort ? tmp : tmp.reverse();
        for (let i of sortEls) {
            sortParentEl.insertBefore(i, sortParentEl.firstChild);
        }
        const newYs: number[] = sortedTimerObject.map(v => v.DOMEls.TimerElement.getBoundingClientRect().top);
        const deltas: number[] = oldsYs.map((v, i) => v - newYs[i]);
        requestAnimationFrame(() => {
            sortedTimerObject.forEach((v, i) => {
                v.DOMEls.TimerElement.style.transition = "all 0s";
                v.DOMEls.TimerElement.style.transform = `translateY(${deltas[i]}px)`;
            });
            requestAnimationFrame(() => {
                sortedTimerObject.forEach((v, i) => {
                    v.DOMEls.TimerElement.style.transition = "all 0.1s";
                    v.DOMEls.TimerElement.style.transform = ``;
                });
            });
        })

    }

    static getSortfunction() {
        switch (this.sortMethod) {
            case "date":
                return (a: Timer, b: Timer) => a.endDate.getTime() - b.endDate.getTime();
            case "id":
                return undefined;
            case "name":
                return undefined;
            case "remainingTime":
                return (a: Timer, b: Timer) => (a.endDate.getTime() - new Date().getTime()) - (b.endDate.getTime() - new Date().getTime());
        }
    }

    static updatedomLoop() {
        for (let i of this.TimersList) {
            i.updateDom();

        }
        if (this.looping) {
            requestAnimationFrame(this.updatedomLoop.bind(this));
        }
    }

    toTimerData(): TimerData {
        return {
            endDate: this.endDate.getTime(),
            name: this.name,
            id: this.id,
            notSent: this.notificationSent,
            creationDate: this.creationDate.getTime()
        }
    }

    updateDom() {


        const timeLeft = Math.abs(this.endDate.getTime() - new Date().getTime());
        const TLD = new Date(timeLeft);
        if (timeLeft < 3600000) {
            //less than an hour left
            this.DOMEls.TimeElement.innerHTML = DateToStringMS(TLD);
        } else {
            //more than an hour left
            this.DOMEls.TimeElement.innerHTML = DateToStringHM(TLD, true);
        }
        if (this.endDate.getTime() - new Date().getTime() < -1000) {
            if (!this.DOMEls.TimerElement.classList.contains("passed")) this.DOMEls.TimerElement.classList.add("passed");
            this.DOMEls.TimeElement.innerHTML = "-" + this.DOMEls.TimeElement.innerHTML;
            if (!this.notificationSent) {
                this.notificationSent = true;
                new Notification(`your timer ${this.name} has hit 0`);
            }
        } else {
            if (this.DOMEls.TimerElement.classList.contains("passed")) this.DOMEls.TimerElement.classList.remove("passed");
        }

        if (timeLeft < 10000 && this.endDate.getTime() - new Date().getTime() > -1000) {
            if (!this.DOMEls.TimerElement.classList.contains("soon")) this.DOMEls.TimerElement.classList.add("soon");
        } else {
            if (this.DOMEls.TimerElement.classList.contains("soon")) this.DOMEls.TimerElement.classList.remove("soon");
        }
        this.DOMEls.DelayElement.innerHTML = DateToStringHM(this.endDate);
    }

    delete() {
        this.deleteWithoutDB();
        ipcRenderer.send("removeTimersReq", this.id);
        Timer.sort();
    }

    deleteWithoutDB() {
        Timer.TimersList.splice(<number>Timer.TimersList.map((v, i) => v.id === this.id ? i : null).filter(v => v !== null)[0], 1);
        this.removeFromDom();
    }

    removeFromDom(fancy = false) {
        if (fancy) {
            requestAnimationFrame(() => {
                this.DOMEls.TimerElement.style.transform += " translateX(-100%)";
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        this.DOMEls.TimerElement.remove();
                    }, 200);
                });
            });
        } else {
            requestAnimationFrame(() => {
                this.DOMEls.TimerElement.style.opacity = "1";
                this.DOMEls.TimerElement.style.transition = "all 0.2s";
                requestAnimationFrame(() => {
                    this.DOMEls.TimerElement.style.opacity = "0";
                    this.DOMEls.TimerElement.style.transition = "all 0.2s";
                    requestAnimationFrame(() => {
                        this.DOMEls.TimerElement.remove();
                    });
                });
            });
        }
    }

    static deleteAll() {
        for (let i of this.TimersList) {
            i.removeFromDom(true);
        }
        ipcRenderer.send("removeTimersReq", ...this.TimersList.map(v => v.id));
        this.TimersList.splice(0, this.TimersList.length);
    }

}

Timer.updatedomLoop();

function DateToStringHM(date: Date, rm1h: boolean = false) {
    const f = (str: string | number) => new Array(2 - (str + "").length).fill("0").join("") + str;
    return `${f(date.getHours() - <number><unknown>rm1h)}:${f(date.getMinutes())}`
}

function DateToStringMS(date: Date) {
    const f = (str: string | number) => new Array(2 - (str + "").length).fill("0").join("") + str;
    return `${f(date.getMinutes())}:${f(date.getSeconds())}`;
}

timerEndInput.value = "00:01:00"
timerHourInput.value = DateToStringHM(new Date(new Date().getTime() + 60000));

timerEndInput.addEventListener("input", () => {
    priority = true;
    updateInputs();
});
timerHourInput.addEventListener("input", () => {
    priority = false;
    updateInputs();
});

function updateInputs() {
    if (priority) {
        let t = timerEndInput.valueAsNumber
        const ch = DateToStringHM(new Date(new Date().getTime() + t));
        if (timerHourInput.value !== ch) {
            timerHourInput.value = ch
        }
    } else {
        const dh = new Date().getHours() * 3600000 + new Date().getMinutes() * 60000 + new Date().getSeconds() * 1000 + new Date().getMilliseconds();
        let t = 0;
        let h = 0;
        let m = 0;
        timerHourInput.value.split(':').map((v, i) => {
            if (i === 0) {
                h = parseInt(v);
                t += parseInt(v) * 3600000
            } else {
                m = parseInt(v);
                t += parseInt(v) * 60000
            }
        });
        if (t < dh) {
            t += 24 * 3600000
        }
        const d = new Date(t - dh);

        timerEndInput.value = DateToStringHM(d).split(":").shift() + ":" + DateToStringMS(d);
    }
}

setInterval(updateInputs, 1000);

timerNewButton.addEventListener("mousedown", () => { new Timer(new Date(new Date().getTime() + timerEndInput.valueAsNumber), timerNameInput.value === "" ? "untitled" : timerNameInput.value) });
timerDelbutton.addEventListener("mousedown", () => Timer.deleteAll());