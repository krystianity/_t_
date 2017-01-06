const EventEmitter = require("events");
const yahooFinance = require("yahoo-finance");
const uuid = require("uuid");

const FIELDS = ["s", "a", "b", "b2", "b3", "x", "v", "c1", "c6", "g", "h"];
const INTV_SPEED = 6000;

class S {

    constructor(config){
        this.config = config;
    }

    _build(snapshot){
        return new Promise((resolve, _) => {
            snapshot.id = uuid.v4();
            resolve(snapshot);
        });
    }

    _getSnapshots(symbols){
        return new Promise((resolve, reject) => {
            yahooFinance.snapshot({
                symbols,
                fields: FIELDS
            }, (err, snapshot) => {
                if(err){
                    return reject(err);
                }
                resolve(snapshot);
            });
        });
    }

    _startPolling(symbols){

        const ee = new EventEmitter();

        setInterval(() => {
            this._getSnapshots(symbols).then(snapshots => {
                Promise.all(Object.keys(snapshots).map(key =>
                    this._build(snapshots[key]))).then(builds => {
                        builds.forEach(build => {
                            ee.emit("data", build);
                        });
                });
            }, e => { ee.emit("error", e); });
        }, INTV_SPEED);

        return ee;
    }

    openStream(symbols){
        return new Promise(resolve => {
            resolve(this._startPolling(symbols));
        });
    }
}

module.exports = S;