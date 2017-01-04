const EventEmitter = require("events");
const Twitter = require("twitter");
const sentiment = require("sentiment");
const languagedetect = require("languagedetect");

class TwitterStream extends EventEmitter {
	
	constructor(stream, language){
		super();
		this._init(stream, language);
	}
	
	_init(stream, language){
		
		stream.on("data", event => {
			
			const text = event.text;
			const lang = language.detect(text, 3);
			
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
	}
	
	openStream(topic = "twitter"){
		return new Promise(resolve => {
			const target = { track: topic };
			this.client.stream("statuses/filter", target, stream => {
				const ts = new TwitterStream(stream, this.language);
				resolve(ts);
			});
		});
	}
	
	run(){
		this.openStream("nba").then(stream => {
			
			let rating = 0.0;
			let crating = 0.0;
			let total = 0;
			let notEng = 0;
			const start = Date.now();
			
			setInterval(() =>{
				process.stdout.write("\u001b[2J\u001b[0;0H");
				console.log({
					score: rating,
					comparative: crating,
					total,
					notEng,
					minutes: ((Date.now() - start) / 1000 / 60)
				});
			}, 2500);
			
			stream.on("data", data => {
				rating += data.analysis.score;
				crating += data.analysis.comparative;
				total++;
			});
			
			stream.on("bad-language", text => {
				notEng++;
			});
		});
	}
}

module.exports = T;