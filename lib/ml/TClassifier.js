const dclassify = require("dclassify");

const Classifier = dclassify.Classifier;
const DataSet    = dclassify.DataSet;
const Document   = dclassify.Document;

class TClassifier {

    constructor(db){
        this.db = db;
    }

    trainWithDatabaseForValueAnalysis() {

        let loadTweetsBatch = null;
        loadTweetsBatch = (index, documents, callback) => {

            if(!documents){
                documents = {};
            }

            if(!documents.good){
                documents.good = [];
            }

            if(!documents.bad){
                documents.bad = [];
            }

            this.db.getTweetsForTraining(index, 250).then(tweets => {

                if(!tweets || tweets.length <= 0){
                    return callback(null, documents);
                }

                tweets.forEach(t => {

                    if(typeof t.manualRating !== "boolean"){
                        console.log("manualRating is not a boolean!");
                        return;
                    }

                    if(t.manualRating){
                        documents.good.push(new Document(t.id, t.classifierContent.split(" ")));
                    } else {
                        documents.bad.push(new Document(t.id, t.classifierContent.split(" ")));
                    }
                });

                if(tweets.length < 250){
                    callback(null, documents);
                } else {
                    index += tweets.length;
                    loadTweetsBatch(index, documents, callback);
                }
            }, e => {
                callback(e);
            });
        };

        return new Promise((resolve, reject) => {
            loadTweetsBatch(0, null, (err, documents) => {

                if(err){
                    return reject(err);
                }

                console.log(`documents: good ${documents.good.length}, bad. ${documents.bad.length}.`);

                const dataset = new DataSet();
                dataset.add("valuable", documents.good);
                dataset.add("useless", documents.bad);

                const classifier = new Classifier({});
                classifier.train(dataset);
                resolve(classifier);
            });
        });
    }

    rateFullDb(classifier){

        let grab = null;
        grab = (index, event, callback) => {
            this.db.getTweetsForClassifierRating(index, 25).then(tweets => {

                if(!tweets || tweets.length <= 0){
                    return callback("no more data");
                }

                event(tweets, () => {
                    if(tweets.length < 25){
                        return callback("no more data");
                    } else {
                        index += tweets.length;
                        grab(index, event, callback);
                    }
                });
            }, e => callback(e));
        };

        return new Promise((resolve, reject) => {

            let document = null;
            let rating = null;
            let count = 0;

            grab(0, (tweets, done) => {

                count += tweets.length;
                console.log(`rating ${tweets.length}/${count} tweets.`);

                Promise.all(tweets.map(t => {

                    if(!t || !t.id || !t.classifierContent || t.classifierContent === "" ||
                        t.classifierContent === " " || t.classifierContent.indexOf(" ") === -1){
                        console.log("empty content for tweet: " + t.id);
                        return null;
                    }

                    document = new Document(t.id, t.classifierContent.split(" "));
                    rating = classifier.classify(document);
                    return this.db.setClassifierRating(t.id, rating.category);
                })).then(_ => {
                    setTimeout(done, 50);
                }, e => {
                    console.log(e);
                   setTimeout(done, 5000);
                });

            }, result => {

                if(typeof result === "string"){
                    return resolve(result);
                }

                reject(result);
            });
        });
    }

}

module.exports = TClassifier;