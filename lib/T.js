const EventEmitter = require("events");
const Twitter = require("twitter");
const sentiment = require("sentiment");
const languagedetect = require("languagedetect");
const uuid = require("uuid");

const Database = require("./Database.js");

class TwitterStream extends EventEmitter {
	
	constructor(stream, language){
		super();
		this._init(stream, language);
	}
	
	_init(stream, language){

		stream.on("data", event => {
			
			const text = event.text;
			const lang = language.detect(text, 3);

			if(!lang || !lang[0]){
				return;
			}
			
			if(lang[0][0] !== "english"){
				this.emit("bad-language", text);
				return;
			}
			
			const result = sentiment(text);
			this.emit("data", {
				info: {
					created_at: event.created_at,
					retweets: event.retweet_count,
					favorites: event.favorite_count,
					entities: event.entities,
					user: {
						id: event.user.id,
						name: event.user.name,
						screen_name: event.user.screen_name,
						statuses: event.user.statuses_count,
						location: event.user.location,
						followers: event.user.followers_count,
						friends_count: event.user.friends_count,
						created_at: event.user.created_at,
						verified: event.user.verified
					}
				},
				text: event.text,
				analysis: {
					language: lang,
					score: result.score,
					comparative: result.comparative,
					positive: result.positive,
					negative: result.negative
				} 
			});
		});
		
		stream.on("error", error => {
			console.log(error);
		});
	}
}

class T {
	
	constructor(config){
		this.client = new Twitter(config.twitter);
		this.language = new languagedetect();
		this.db = null;
	}
	
	openStream(topics = "twitter,nba"){
		return new Promise(resolve => {
			const target = { track: topics };
			this.client.stream("statuses/filter", target, stream => {
				const ts = new TwitterStream(stream, this.language);
				resolve(ts);
			});
		});
	}

	static analysePopularity(tweet){

		let popularity = 0;

		if(tweet.retweets > 5){
			popularity++;
		}

		if(tweet.retweets > 50){
			popularity++;
		}

		if(tweet.retweets > 200){
			popularity++;
		}

		if(tweet.retweets > 500){
			popularity++;
		}

		if(tweet.retweets > 1000){
			popularity++;
		}


		if(tweet.favorites > 5){
			popularity++;
		}

		if(tweet.favorites > 50){
			popularity++;
		}

		if(tweet.favorites > 200){
			popularity++;
		}

		if(tweet.favorites > 500){
			popularity++;
		}

		if(tweet.favorites > 1000){
			popularity++;
		}

		return popularity;
	}

	static analyseConfidence(tweet){

		let confidence = 0;

		if(tweet.userVerified){
			confidence += 5;
		}

		if(tweet.userFollowers > 100){
			confidence++;
		}

		if(tweet.userFollowers > 500){
			confidence++;
		}

		if(tweet.userFollowers > 1000){
			confidence++;
		}

		if(tweet.userFollowers > 5000){
			confidence++;
		}

		if(tweet.userFollowers > 10000){
			confidence++;
		}

		if(tweet.userFollowers > 25000){
			confidence++;
		}

		if(tweet.userFollowers > 50000){
			confidence++;
		}

		if(tweet.userFollowers > 100000){
			confidence++;
		}

		if(tweet.userFollowers > 250000){
			confidence++;
		}

		if(tweet.userFollowers > 500000){
			confidence++;
		}

		return confidence;
	}

	static analyseTopics(topics, text){

		const ts = [];
		topics.forEach(t => {
			t = t.toLowerCase();
			if(text.toLowerCase().indexOf(t) !== -1){
				ts.push(t);
			}
		});

		return ts.join(",");
	}
	
	run(){
		const targetStreams = process.argv[2];
		console.log(`targeting streams for ${targetStreams}.`);

		if(!targetStreams){
			return;
		}
		const topics = targetStreams.split(",");
		this.db = new Database(targetStreams + "_");

		this.openStream(targetStreams).then(stream => {
			
			let rating = 0.0;
			let crating = 0.0;
			let total = 0;
			let stored = 0;
			let notEng = 0;
			let processed = 0;
			const start = Date.now();
			
			setInterval(() =>{
				process.stdout.write("\u001b[2J\u001b[0;0H");
				console.log({
					score: rating,
					comparative: crating,
					stored,
					total,
					notEng,
					minutes: ((Date.now() - start) / 1000 / 60),
					pKByte: (processed / 1000),
					db: this.db.dbName
				});
			}, 2500);

			stream.on("data", data => {

				total++;

				const tweet = {
					id: uuid.v4(),
					score: data.analysis.score,
					comparative: data.analysis.comparative,
					confidence: -1,
					popularity: -1,
					topics: "",
					createdAt: data.info.created_at,
					processedAt: Date.now(),
					retweets: data.info.retweets,
					favorites: data.info.favorites,
					userVerified: data.info.user.verified,
					userFollowers: data.info.user.followers,
					userId: data.info.user.id,
					userName: data.info.user.name,
					userLocation: data.info.user.location,
					content: data.text
				};
				tweet.popularity = T.analysePopularity(tweet);
				tweet.confidence = T.analyseConfidence(tweet);
				tweet.topics = T.analyseTopics(topics, data.text);

				if(tweet.topics === ""){
					return;
				}

				rating += data.analysis.score;
				crating += data.analysis.comparative;
				stored++;
				processed += (Buffer.byteLength(JSON.stringify(tweet), "utf8") - 220);

				this.db.upsertTweet(tweet).then(result => {}, e => { console.log(e); });
			});
			
			stream.on("bad-language", text => {
				notEng++;
			});
		});
	}
}

module.exports = T;