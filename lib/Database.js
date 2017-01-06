const Sequelize = require("sequelize");
const uuid = require("uuid");

class Database {

    constructor(path = "", rnd = false){

        this.dbName = "./dbs/" + path + (rnd ? uuid.v4() : "g") + ".sqlite";

        this.sequelize = new Sequelize("tee", "tee", "tee", {
            dialect: "sqlite",
            storage: this.dbName,
            logging: () => {}
        });

        this.tweets = this.sequelize.define("tweets", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true
            },
            topic: Sequelize.STRING,
            score: Sequelize.DOUBLE,
            comparative: Sequelize.DOUBLE,
            confidence: Sequelize.INTEGER,
            popularity: Sequelize.INTEGER,
            createdAt: Sequelize.DATE,
            processedAt: Sequelize.DATE,
            retweets: Sequelize.INTEGER,
            favorites: Sequelize.INTEGER,
            userVerified: Sequelize.BOOLEAN,
            userFollowers: Sequelize.INTEGER,
            userId: Sequelize.STRING,
            userName: Sequelize.STRING,
            userLocation: Sequelize.STRING,
            content: Sequelize.TEXT
        });

        this.stocks = this.sequelize.define("stocks", {
            id: {
                type: Sequelize.UUID,
                primaryKey: true
            },
            symbol: Sequelize.STRING,
            ask: Sequelize.DOUBLE,
            bid: Sequelize.DOUBLE,
            askRealtime: Sequelize.DOUBLE,
            bidRealtime: Sequelize.DOUBLE,
            stockExchange: Sequelize.STRING,
            volume: Sequelize.INTEGER,
            change: Sequelize.DOUBLE,
            changeRealtime: Sequelize.DOUBLE,
            daysLow: Sequelize.DOUBLE,
            daysHigh: Sequelize.DOUBLE
        });

        this.sequelize.sync();
    }

    upsertTweet(tweet){
        return this.tweets.upsert(tweet);
    }

    upsertStock(stock){
        return this.stocks.upsert(stock);
    }
}

module.exports = Database;