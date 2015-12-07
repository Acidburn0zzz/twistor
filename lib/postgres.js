"use strict";

const _ = require("lodash");
const Promise = require("bluebird");
const pg = require("pg");

//FIXME this should go in envs
const config = require("../config.json");

const selectFields = [
	"d.id",
	"d.user_id",
	"tweet",
	"tweet_time",
	"time_diff",
	"source",
	"name",
	"screen_name",
	"avatar",
	"delete_time",
	"description",
	"lang",
	"verified"
].join(",");

const exec = (query, params) => {
	params = params || [];

	return new Promise((Y,N) => {
		pg.connect(config.db, (err, client, done) => {
			if(err) {
				done();
				N(err);
			}

			client.query(query, params, (err,data) => {
				done();
				if(err)
					N(err);
				else
					Y(data);
			});
		});
	});
};

module.exports = {
	init: () => 
		exec(`BEGIN;
			
			CREATE TABLE IF NOT EXISTS users (
				id bigint PRIMARY KEY,
				name text NOT NULL,
				screen_name text NOT NULL,
				description text,
				verified boolean NOT NULL,
				avatar text NOT NULL,
				harvested TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
			);

			CREATE TABLE IF NOT EXISTS categories (
				id serial PRIMARY KEY,
				category text NOT NULL UNIQUE
			);

			CREATE TABLE IF NOT EXISTS user_cats (
				user_id bigint NOT NULL REFERENCES users,
				cat_id integer NOT NULL REFERENCES categories,
				PRIMARY KEY (user_id,cat_id)
			);
			
			CREATE TABLE IF NOT EXISTS tweets (
				id bigint PRIMARY KEY,
				user_id bigint NOT NULL REFERENCES users,
				tweet text NOT NULL,
				source text NOT NULL,
				reply_to_id bigint,
				lang text NOT NULL,
				tweet_time bigint NOT NULL,
				harvested TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
			);
			
			CREATE TABLE IF NOT EXISTS deletions (
				id bigint PRIMARY KEY REFERENCES tweets,
				user_id bigint NOT NULL REFERENCES users,
				delete_time bigint NOT NULL,
				time_diff integer NOT NULL,
				harvested TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
			);
			
			CREATE TABLE IF NOT EXISTS orphan_deletions (
				id bigint PRIMARY KEY,
				user_id bigint NOT NULL,
				delete_time bigint NOT NULL,
				harvested TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
			);
			
			CREATE INDEX IF NOT EXISTS screen_name_index ON users (LOWER(screen_name));
			CREATE INDEX IF NOT EXISTS tweet_time_index ON tweets (tweet_time);
			CREATE INDEX IF NOT EXISTS delete_time_index ON deletions (delete_time);
			CREATE INDEX IF NOT EXISTS time_diff_index ON deletions (time_diff);
			CREATE INDEX IF NOT EXISTS d_user_id_index ON deletions (user_id);
			
			COMMIT;
		`)
		.catch(err => {
			//FIXME there has to be a more sensible way to handle this lol
			console.log("db init error (this is very bad)\n",err);
			process.exit();
		}),
	addTweet: tweet =>
		exec("INSERT INTO tweets (id,user_id,tweet,source,reply_to_id,lang,tweet_time) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING", [tweet.id_str,tweet.user.id_str,tweet.text,tweet.source,tweet.in_reply_to_status_id_str,tweet.lang,tweet.timestamp_ms]),
	upsertUser: user =>
		exec("INSERT INTO users (id,name,screen_name,description,verified,avatar) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$2,screen_name=$3,description=$4,verified=$5,avatar=$6", [user.id_str,user.name,user.screen_name,user.description,user.verified,user.profile_image_url]),
	addDeletion: del =>
		exec("SELECT EXISTS (SELECT id FROM tweets WHERE id=$1) AS exists", [del.status.id_str])
			.then(result => result.rows[0].exists ? 
				"INSERT INTO deletions (id,user_id,delete_time,time_diff) VALUES ($1,$2,$3,$3 - (SELECT tweet_time FROM tweets WHERE id=$1)) ON CONFLICT DO NOTHING" :
				"INSERT INTO orphan_deletions (id,user_id,delete_time) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING"
			)
			.then(q => exec(q,[del.status.id_str,del.status.user_id_str,del.timestamp_ms])),
	//args: skip n, take n, u n, (category, tbd), sort [sorts], asc t/f
	select: args => {
		const params = [].concat(
			args.take,
			args.skip,
			args.u ? args.u : [],
			args.cat ? args.cat : []
		);

		const q = `SELECT ${selectFields}
			FROM users u, tweets t, deletions d
			${args.cat ? "INNER JOIN user_cats uc ON uc.user_id = d.user_id INNER JOIN categories c ON c.id = uc.cat_id" : ""}
			WHERE u.id = t.user_id AND d.id = t.id
			${args.u ? "AND u.id = $3" : ""}
			${args.u && args.cat ? "AND c.category = $4" : args.cat ? "AND c.category = $3" : ""}
			ORDER BY ${args.sort}
			${args.asc ? "ASC" : "DESC"}
			LIMIT $1 OFFSET $2`;
		console.log(q.replace(/\s+/g," "));

		//TODO doing this every time is wasteful. reltuples isn't guarenteed exact soo cache counts somewhere
		//maybe add an autoupdating column to user table with their delete count
		//that would actually be cool to display on frontend too, plus much cheaper to sum than to do this
		const count = exec(`SELECT COUNT(*) FROM deletions d
			${args.cat ? "INNER JOIN user_cats uc ON uc.user_id = d.user_id INNER JOIN categories c ON c.id = uc.cat_id" : ""}
			${args.u ? "WHERE d.user_id = $1" : ""}
			${args.u && args.cat ? "AND c.category = $2" : args.cat ? "WHERE c.category = $1" : ""}`, params.slice(2));

		//FIXME err I didn't think exec through, this is taking a second connection from the pool
		//not a terribly annoying fix to let it take a list of queries tho; alternatively combine into one
		const rows = exec(q, params);

		return Promise.all([count,rows]).then(cr => {
			return {
				rows: cr[1].rows,
				//TODO does this object exist if the select matches 0 rows?
				total: cr[0].rows[0].count,
				take: params[0],
				skip: params[1]
			};
		});
	},
	//TODO this is an obv cache target, given list of followings it will taper off into a stable list
	//TODO also might be nice to do impartial matches for a suggestion list?
	snToUid: name =>
		exec("SELECT id FROM users WHERE LOWER(screen_name)=LOWER($1)", [name])
			.then(result => result.rows.length > 0 ? { u: result.rows[0].id } : Promise.reject(204))
};
