"use strict";

const config = require("./config.json");
const Twit = require("twit");
const throttle = require("lodash/function/throttle");
const R = require("ramda");
const sql = require("./db.js");

const T = new Twit(config.tw);

const self = 3717100756;

//after deciding whether to keep a tweet, R.pick this list
//TODO actually I guess these are unnecessary, I'm just passing references around and choosing fields by name anyway
//I guess maybe useful for prettyprint but that's kinda it
const keys = [
	"id_str",
	"text",
	"source",
	"in_reply_to_status_id_str",
	"user",
	"lang",
	"timestamp_ms"
];

const ukeys = [
	"id_str",
	"name",
	"screen_name",
	"description",
	"verified",
	"profile_image_url"
];

const processTweet = tweet => {
	tweet.source = /^<(?:.*?)>(.*)<\/a>$/.exec(tweet.source)[1];

	return tweet;
};


//---------

console.log(`twistor\nstarting @ ${new Date().toISOString()}`);

sql.init().then(() => console.log("db connected"));
const stream = T.stream("user");

stream.on("connected", () => console.log("stream open"));

stream.on("tweet", tweet => {
	if(tweet.user.id == self || tweet.retweeted_status || tweet.user.protected == true)
		return;

	const ptweet = processTweet(tweet);

	sql.addUser(ptweet.user)
	.then(() => sql.addTweet(ptweet))
	.catch(err => console.log(`db add error\nerror:\n${err}\ntweet:\n${JSON.stringify(ptweet,null,"\t")}`));

	console.log(JSON.stringify(ptweet,null,"\t"))
});

stream.on("delete", deletion => {
	sql.addDeletion(deletion.delete)
	//TODO seperate table for orphaned deletes imo
	//for now the fkey will fail and it'll go to logs at least
	.catch(err => console.log(`db deletion add error\nerror:\n${err}\nmsg:\n${JSON.stringify(deletion,null,"\t")}`));
});
