#twistor

a small program for archiving tweets and deletion notices. I intend to use it to replace politwoops for american politicians, and I hope to develop it into a reasonably easy way for others to do the same in their own locales. there is nothing that restricts it to politicians, however, so people may point it at arbitrary twitter timelines as they see fit.

presently it's not quite ready for primetime, but it's getting there. if you do want to use it at this very moment though, you need a postgres db somewhere. installation guides [here](https://wiki.postgresql.org/wiki/Detailed_installation_guides) (*UPDATE*: these instructions are no longer sufficient, at the present (2015-11-13) twistor depends on postgres 9.5), but it doesn't matter if it's local or remote. you also need a `config.json` file in the project root, of the form:

```
{
	"db": "postgres://uname:pw@host:port/dbname",
	"tw": {
		"consumer_key": "stuff",
		"consumer_secret": "stuff",
		"access_token": "stuff",
		"access_token_secret": "stuff"
	}
}
```

postgres defaults to port 5432 everywhere afaik.

twitter credentials you need to tie a phone number to your account. I just use google voice, but if anonymity is a major concern there are places to buy numbers with bitcoin. go to [apps.twitter.com](https://apps.twitter.com) and create a new app. be aware name and description are public. website can be anything, it doesn't matter. permissions can be read-only if you want (note to self, actually check to make sure this is true lol). generate an access token and you now have all the credentials you need.

do `node listener.js` and as long as it's all set up right it will archive every tweet by everyone you follow, excluding protected accounts, retweets, and tweets from the authenticating user. it's (as of 2015/11/13) line 35 if you want to change the exclusions. it will upsert the user object on every tweet. deletion messages are linked to archived tweets, but if the tweet isn't in the db, the delete message is added to the table orphan_deletions, in case it may be of use. I'm only storing tweet fields I think are vital (though I'm open to suggestions on what else may be important). listener.js and lib/postgres.js are the only files necessary for archiving.

server.js uses the same lib/postgres.js file to do selects on users + tweets + deletions, with the option of filtering by category and and twitter handle. it's mostly good to go, though I do have a few other things to add. `make` builds the javascript in web/src/. the server is totally independent from the listener itself, they could be run on separate machines as long as they both have access to the db.

the listener is reasonably safe to use on any account. from twitter's perspective you are one of likely hundreds of thousands generic user streams, they can't actually see what you're doing with the data they send. it is entirely possible you may draw their ire if you start, say, posting politicians' deleted tweets on a public website or something like that. so unless you don't tell anyone what you're doing, it would be prudent to use a throwaway account. use at your own risk not responsible if b& etc.

##short term plans
* ~~server.js becomes the backend for a site exposing deletions~~
* ~~simple frontend for said site, obv~~
* ~~table for orphan deletion notices~~
* actually set up eslint + some test framework
* ~~pretty up the site some~~
* ~~user lookup is broken still~~
* ~~category lookup~~
* archive and display the links replaced by t.co's
* prep for deploy and do it

##longer term plans
* fetch tweets after n days to see favs/rts/replies so we can sort deletions by how much ppl cared about the tweet
* option of sqlite, lower the barrier of entry for ppl who just want to run it on their laptop or w/e
* host images on imgur or something
* archive embedded tweets maybe
* post method by default + tls with letsencrypt
* serverside templating as a fallback for folks using noscript. for now just tell them how to form proper urls for the api endpoint
* package for npm? docker container? something else? I want non-programmers to be able to use this without too much fuss
* click thru to view the deleted tweet in context of prev/following tweets on the tl (this requires api... realistically from the user's acct ugh)
