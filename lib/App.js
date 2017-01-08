const usage = require("pidusage");
const murmur = require("murmurhash");
const fs = require("fs");
const path = require("path");

const T = require("./streams/T.js");
const S = require("./streams/S.js");
const Database = require("./Database.js");
const RateValueCli = require("./cli/RateValue.js");
const TClassifier = require("./ml/TClassifier.js");

class App {

    constructor(config){

        this.config = config;
        this.t = new T(this.config.twitter);
        this.s = new S();
        this.db = null;

        this.startTime = Date.now();
        this.stats = {
            tprocessed: 0,
            tweets: 0,
            stocks: 0,
            runtime: 0,
            cpu: 0,
            memory: 0,
            dbSize: 0
        };
    }

    _print(){

        setInterval(() => {
            usage.stat(process.pid, (err, stat) => {

                if(err){
                    return;
                }

                this.stats.cpu = stat.cpu.toFixed(2) + " %";
                this.stats.memory = (stat.memory / 1024.0 / 1024.0).toFixed(2) + " MB";

                usage.unmonitor(process.pid);
            });
        }, 1500);

        setInterval(() => {
            gc(); //manual gc to prevent usage.stat from stacking up
        }, 10000);

        setInterval(() => {
            fs.stat(path.join(__dirname, "../" + this.db.dbName), (err, stats) => {

                if(err){
                    console.log(err);
                    return;
                }

                this.stats.dbSize = (stats.size / 1024.0 / 1024.0).toFixed(2) + " MB";
            });
        }, 5000);

        setInterval(() => {
            this.stats.runtime = ((Date.now() - this.startTime) / 1000.0 / 60.0).toFixed(2) + " min";
            process.stdout.write("\u001b[2J\u001b[0;0H");
            console.log(this.stats);
        }, 950);
    }

    run(){

        const action = process.argv[2];
        const topics = this.config.targets.map(s => s.topic).filter(v => !!v);
        const symbols = this.config.targets.map(s => s.symbol).filter(v => !!v);

        console.log(`targeting streams for ${topics}.`);
        console.log(`targeting symbols for ${symbols}.`);
        console.log(`executive action: ${action}.`);

        this.db = new Database(murmur.v3(topics.join(",")));

        let tclass = null;

        switch(action){

            case "stream":
                this.writeTweetsToDatabase(topics, symbols);
                this._print();
                break;

            case "stream-all":
                this.writeTweetsToDatabase(topics, symbols);
                this.writeStockToDatabase(symbols);
                this._print();
                break;

            case "rate-value":
                const rvcli = new RateValueCli(this.db);
                rvcli.start();
                break;

            case "classify-value":
                tclass = new TClassifier(this.db);
                tclass.trainWithDatabaseForValueAnalysis().then(classifier => {
                    const testDoc = new (require("dclassify").Document)("test", ["i", "love", "my", "tesla", "stock"]);
                    const result = classifier.classify(testDoc);
                    console.log(result);
                }).catch(e => console.log(e));
                break;

            case "classify-value-all":
                tclass = new TClassifier(this.db);
                tclass.trainWithDatabaseForValueAnalysis()
                    .then(classifier => tclass.rateFullDb(classifier))
                    .then(result => console.log(result))
                    .catch(e => console.log(e));
                break;

            case "overview":
                this.db.getTweetStatsOverviewBetween(
                    new Date(process.argv[3]),
                    new Date(process.argv[4])
                ).then(result => console.log(result),
                    e => console.log(e));
                break;

            default: throw new Error(`action ${action} is not known.`);
        }
    }

    writeTweetsToDatabase(topics, symbols){
        this.t.openStream(topics,symbols).then(stream => {

            stream.on("incoming", _ => {
                this.stats.tprocessed++;
            });

            stream.on("data", tweet => {
                this.db.upsertTweet(tweet).then(result => {
                    this.stats.tweets++;
                }, e => { console.log(e); });
            });

            stream.on("error", error => console.log(error));
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