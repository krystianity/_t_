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
            topics: Sequelize.STRING,
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

        this.sequelize.sync();
    }

    upsertTweet(tweet){
        return this.tweets.upsert(tweet);
    }
}

module.exports = Database;