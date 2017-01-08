const readline = require("readline");

class RateValue {

    constructor(db){
        this.db = db;
    }

    start(_callback){

        let grab = null;
        grab = (index, event, callback) => {
            this.db.getTweetsForManualRating(index, 1).then(tweets => {
                
                if(!tweets || tweets.length <= 0){
                    return callback("no more data.");
                }

                event(tweets[0], () => {

                    if(tweets.length < 1){
                        return callback("no more data.");
                    }

                    index += tweets.length;
                    grab(index, event, callback);
                });
                
            }, e => callback(e));
        };

        const rli = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const dq = " . \n('y' means 'valuable', other or empty means 'useless'.)\n[y,]?";

        grab(0, (tweet, done) => {
            process.stdout.write("\u001b[2J\u001b[0;0H");
            rli.question(tweet.classifierContent + dq, answer => {

                const rating = answer === "y";

                this.db.setManualRating(tweet.id, rating).then(_ => {
                    setTimeout(done, 50);
                }, e => {
                    console.log(e);
                    setTimeout(done, 5000);
                });
            });
        }, (reason) => {
            rli.close();
            console.log(reason);
            if(_callback){
                _callback();
            }
        });
    }

}

module.exports = RateValue;