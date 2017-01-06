const T = require("./streams/T.js");
const S = require("./streams/S.js");
const Database = require("./Database.js");

class App {

    constructor(config){
        this.config = config;
        this.t = new T(this.config.twitter);
        this.s = new S();
        this.db = null;

        this.startTime = Date.now();
        this.stats = {
            tweets: 0,
            stocks: 0,
            runtime: 0
        };
    }

    _print(){
        setInterval(() => {
            this.stats.runtime = (Date.now() - this.startTime) / 1000 / 60;
            process.stdout.write("\u001b[2J\u001b[0;0H");
            console.log(this.stats);
        }, 950);
    }

    run(){

        const topics = this.config.symbols.map(s => s.topic);
        const stocks = this.config.symbols.map(s => s.stock);

        console.log(`targeting streams for ${topics}.`);
        console.log(`targeting symbols for ${stocks}.`);

        this.db = new Database(topics.join(",") + "_");

        this.writeTweetsToDatabase(topics);
        this.writeStockToDatabase(stocks);

        this._print();
    }

    writeTweetsToDatabase(topics){
        this.t.openStream(topics).then(stream => {

            stream.on("data", tweet => {
                this.db.upsertTweet(tweet).then(result => {
                    this.stats.tweets++;
                }, e => { console.log(e); });
            });
        });
    }

    writeStockToDatabase(stocks){
        this.s.openStream(stocks).then(stream => {

            stream.on("data", stock => {
                this.db.upsertStock(stock).then(result => {
                    this.stats.stocks++;
                }, e => { console.log(e); });
            });

            stream.on("error", error => console.log(error));
        });
    }
}

module.exports = App;