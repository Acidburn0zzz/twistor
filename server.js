"use strict";

const _ = require("lodash");
const Promise = require("bluebird");
const express = require("express");
const Twit = require("twit");

//FIXME this should go in envs
const config = require("./config.json");
const sql = require("./lib/postgres.js");

const exp = express();
exp.use(express.static("web/static"));
exp.use(express.static("web/build"));

const queryArgs = [
	"u",
	"skip",
	"take",
	"sort",
	"asc",
	"cat"
];

const sorts = [
	"tweet_time",
	"delete_time",
	"time_diff"
];

const cats = [
	"senate",
	"house",
	"cabinet",
	"governors",
	"mayors",
	"candidates"
];

const parseQuery = raw => {
	let finished = {};

	finished.take = raw.take > 0 && raw.take <= 50 && raw.take == (raw.take|0) ? raw.take : 20;
	finished.skip = raw.skip > 0 && raw.skip == (raw.skip|0) ? raw.skip : 0;
	finished.sort = _.find(sorts, sort => sort == raw.sort) || "delete_time";
	finished.asc = !!raw.asc && (raw.asc == "true" || raw.asc == "1");

	if(raw.u)
		finished.u = raw.u;
	if(raw.cat && _.contains(cats, raw.cat))
		finished.cat = raw.cat;

	return finished;
};

const port = 8081;

exp.get("/api/search", (req,res) => {
	//every arg is optional, defaults to all users skip 0 take 20 orderby time descending
	const args = parseQuery(req.query);

	sql.select(args)
		//FIXME this might be leaking stack traces to frontend? idk how, but
		//oh wait, no, it could be throwing somewhere and hitting express... hrm
		//obv test lol
		.then(results => res.send(results))
		.catch(err => {
			//FIXME this is hardly "handling" errors lol
			console.log(err);
			res.status(500).send({});
		});
});

exp.get("/api/userid", (req,res) => {
	const uname = req.query.uname;

	/^[a-zA-Z0-9_]{1,15}$/.test(uname) ?
		sql.snToUid(uname)
			.then(results => res.send(results))
			.catch(err => res.status(err == 204 ? 204 : 500).send({u:""})) :
		res.status(400).send({u:""});
});

exp.get("/*", (req,res) => {
	res.sendFile(__dirname + "/web/index.html");
});

exp.listen(port);
console.log(`twistor v${require("./package.json").version}\n${new Date().toISOString()}\nserver @ ${require("os").hostname()}:${port}`);
