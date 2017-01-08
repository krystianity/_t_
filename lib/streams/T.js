const EventEmitter = require("events");
const Twitter = require("twitter");
const sentiment = require("sentiment");
const languagedetect = require("languagedetect");
const uuid = require("uuid");
const emojiStrip = require("emoji-strip");
const natural = require("natural");
const fs = require("fs");
const path = require("path");

const WHITE_LIST = JSON.parse(fs.readFileSync(path.join(__dirname, "../datasets/twhitelist.json"), "utf8"));
const BLACK_LIST = JSON.parse(fs.readFileSync(path.join(__dirname, "../datasets/tblacklist.json"), "utf8"));

class TwitterStream extends EventEmitter {
	
	constructor(stream, language, topics, symbols){
		super();
		this._init(stream, language, topics, symbols);
		//this.tokenizer = new natural.WordTokenizer(); //--> trouble with urls
		this.tokenizer = new natural.RegexpTokenizer({pattern: / /});
	}

	_build(data, topics, symbols){
		return new Promise((resolve, reject) => {

			const tweet = {
				id: uuid.v4(),
				score: data.analysis.score,
				serious: 0,
				guess: "unknown",
				comparative: data.analysis.comparative,
				confidence: -1,
				popularity: -1,
				topic: "",
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
			tweet.topic = T.analyseTopics(topics, data.text);

			if(tweet.topic === ""){
				return reject("no topic");
			}

			if(tweet.score === 0 || tweet.comparative === 0){
				return reject("no score or comparative.")
			}

			//emojis in username or text are not used by serious sources
			const userName = emojiStrip(tweet.userName);
			let text = emojiStrip(tweet.content);

			if(userName !== tweet.userName){
				tweet.serious -= 3;
			}

			if(text !== tweet.content){
				tweet.serious -= 3;
			}

			text = text.toLowerCase();

			//https links refer to a higher possibility in an information tweet
			if(text.indexOf("http") !== -1){
				tweet.serious++;
			}

			const words = TwitterStream._removeHashtags(this.tokenizer.tokenize(text));

			//occuring symbols increase the chance of a direct
			//relation to a stock market action
			symbols.forEach(symbol => {
				if(words.indexOf(symbol) !== -1){
					tweet.serious += 2;
				}
			});

			//occuring special words increase value
			WHITE_LIST.forEach(key => {

				//straight hits
				if(words.indexOf(key) !== -1){
					tweet.serious += 2;
				}

				//somewhere in the text
				if(text.indexOf(key) !== -1){
					tweet.serious++;
				}
			});

			//occuring black listed words decrease value with double amount
			BLACK_LIST.forEach(key => {

				//straight hits
				if(words.indexOf(key) !== -1){
					tweet.serious -= 2;
				}

				//somewhere in the text
				if(text.indexOf(key) !== -1){
					tweet.serious -= 1;
				}
			});

			tweet.bytes = (Buffer.byteLength(JSON.stringify(tweet), "utf8") - 12);
			tweet.classifierContent = this._cleanContentForClassifier(words);

			//"guess" can put a tweet in categories that can be used
			//for different pr
			if(tweet.serious < 0){
				tweet.guess = "conversational";
			} else if(tweet.serious > 3){
				tweet.guess = "fintech";
			} else {
				tweet.guess = "informative";
			}

			resolve(tweet);
		});
	}

	static _removeHashtags(words) {
		return words.map(word => !word.startsWith("#") ? word : word.replace("#", ""));
	}

	_cleanContentForClassifier(words){

		//emojis and hashtags have already been removed
		//but mentions and urls are still in the text

		let content = "";

		words.forEach(word => {

			if(!word || word === "" || word.length === 1){
				return;
			}

			if(word.startsWith("@")){
				return;
			}

			if(word.indexOf("http") !== -1 || word.indexOf("www") !== -1){
				return;
			}

			if(word === "rt"){
				return;
			}

			content += " " + word;
		});

		return content.trim();
	}

	_init(stream, language, topics, symbols){

		stream.on("data", event => {

			const text = event.text;
			this.emit("incoming", text);

			const lang = language.detect(text, 3);

			if (!lang || !lang[0]) {
				return;
			}

			if (lang[0][0] !== "english") {
				this.emit("bad-language", text);
				return;
			}

			const result = sentiment(text);

			const preBuild = {
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
			};

			this._build(preBuild, topics, symbols).then(build => {
				this.emit("data", build);
			}, e => {
				if(typeof e === "string"){
					this.emit("untouched", e);
				} else {
					this.emit("error", e);
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
		this.client = new Twitter(config);
		this.language = new languagedetect();
	}
	
	openStream(topics, symbols){
		return new Promise(resolve => {
			const target = { track: topics.join(",") };
			this.client.stream("statuses/filter", target, stream => {
				const ts = new TwitterStream(stream, this.language, topics, symbols);
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

		if(ts.length !== 1){
			return "";
		} else {
			return ts[0];
		}
	}
}

module.exports = T;