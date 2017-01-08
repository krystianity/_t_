const Sequelize = require("sequelize");
const uuid = require("uuid");

class Database {

    constructor(path = "", rnd = false){

        this.dbName = "dbs/" + path + (rnd ? uuid.v4() : "") + ".sqlite";

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
            guess: Sequelize.STRING,
            serious: Sequelize.INTEGER,
            createdAt: Sequelize.DATE,
            processedAt: Sequelize.DATE,
            retweets: Sequelize.INTEGER,
            favorites: Sequelize.INTEGER,
            userVerified: Sequelize.BOOLEAN,
            userFollowers: Sequelize.INTEGER,
            userId: Sequelize.STRING,
            userName: Sequelize.STRING,
            userLocation: Sequelize.STRING,
            classifierRating: {
                type: Sequelize.BOOLEAN,
                defaultValue: null,
                allowNull: true
            },
            manualRating: {
                type: Sequelize.BOOLEAN,
                defaultValue: null,
                allowNull: true
            },
            content: Sequelize.TEXT,
            classifierContent: Sequelize.TEXT
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

    /* ### TRAINING ### */

    getTweetsForTraining(startAt = 0, size = 1000){
        return this.tweets.findAll({
            attributes: ["id", "topic", "classifierContent", "score", "comparative", "manualRating"],
            where: {
                guess: {
                    $in: ["informative", "fintech"]
                },
                serious: {
                    $gte: 1
                },
                manualRating: {
                    $ne: null
                },
                //classifierRating: null
            },
            offset: startAt,
            limit: size
        });
    }

    getTweetsForManualRating(startAt = 0, size = 3){
        return this.tweets.findAll({
            attributes: ["id", "topic", "classifierContent", "score", "comparative", "guess"],
            where: {
                guess: {
                    $in: ["informative", "fintech"]
                },
                serious: {
                    $gte: 1
                },
                manualRating: null,
                classifierRating: null
            },
            offset: startAt,
            limit: size
        });
    }

    setManualRating(id, rating){
        return this.tweets.update({
            manualRating: rating
        }, {
            where: {
                id: id
            }
        });
    }

    setClassifierRating(id, rating){

        if(typeof rating === "string"){
            rating = rating === "valuable";
        }

        return this.tweets.update({
            classifierRating: rating
        }, {
            where: {
                id: id
            }
        });
    }

    /* ### ANALYSIS ### */

    getTweetsForClassifierRating(startAt = 0, size = 250){
        return this.tweets.findAll({
            attributes: ["id", "topic", "classifierContent", "score", "comparative", "manualRating"],
            where: {
                classifierRating: null
            },
            offset: startAt,
            limit: size
        });
    }

    /*
     SELECT topic,  SUM(score) AS score, SUM(comparative) AS comparative,
     AVG(serious) AS serious,  AVG(manualRating) AS manual FROM tweets
     WHERE createdAt BETWEEN '2017-01-08 14:00:00.000 +00:00' AND '2017-01-08 14:30:00.000 +00:00'
     AND classifierRating = 1
     GROUP BY topic;
     */

    getTweetStatsOverviewBetween(start, end){

        if(!(start instanceof Date) || !(end instanceof Date)){
            return Promise.reject("start and end parameters must be of type Date.");
        }

        start = start.toISOString().slice(0, 19).replace("T", " ");
        end = end.toISOString().slice(0, 19).replace("T", " ");

        return this.sequelize.query(`
            SELECT topic,  SUM(score) AS score, SUM(comparative) AS comparative,
            AVG(serious) AS serious,  AVG(manualRating) AS manual FROM tweets
            WHERE createdAt BETWEEN '${start}' AND '${end}'
            AND classifierRating = 1
            GROUP BY topic;
        `);
    }

}

module.exports = Database;