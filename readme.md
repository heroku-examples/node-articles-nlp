# Node-Articles-NLP

Running Node all the way from development to production on Heroku.

Check it out at [http://node-articles-nlp.herokuapp.com/](http://node-articles-nlp.herokuapp.com/).

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/heroku-examples/node-articles-nlp)

## Local dependencies

- [MongoDB](http://www.mongodb.org/) for data
- [RabbitMQ](http://www.rabbitmq.com/) for job queueing

## Installing

```
$ brew install mongodb rabbitmq
$ brew services start mongodb
$ brew services start rabbitmq
$ npm install
```

## Running

1. `npm start`
2. [http://localhost:5000](http://localhost:5000)

## Deploying

Deploying is easy - just use the Heroku Button:

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/heroku-examples/node-articles-nlp)

If you'd rather clone locally and then deploy through the CLI, you can do that too:

```
git clone git@github.com:heroku-examples/node-articles-nlp.git
cd node-articles-nlp

heroku create

heroku addons:add mongohq
heroku addons:add cloudamqp

heroku config:set NODE_ENV=production
heroku config:set VIEW_CACHE=true
heroku config:set THRIFTY=true

git push heroku master
heroku open
```

## Config

Environment variables are mapped to a config object in [lib/config.js](https://github.com/heroku-examples/node-articles-nlp/blob/master/lib/config.js).
This provides reasonable defaults as well as a layer of generalization
(`process.env.MONGOHQ_URL` => `config.mongo_url`).

You can locally override the defaults by
[adding variables to a .env file](https://github.com/strongloop/node-foreman#environmental-variables).

## Scaling

The app is separated into two tiers:

- the web tier ([server.js](https://github.com/heroku-examples/node-articles-nlp/blob/master/lib/server.js))
- the worker tier ([worker.js](https://github.com/heroku-examples/node-articles-nlp/blob/master/lib/worker.js))

This enables horizontally scaling both web traffic and long-running jobs.

#### On Heroku

The default deploy configuration includes `THRIFTY=true`, which starts the app in single-dyno mode to avoid charges.
With `THRIFTY=true`, the web process handles both http requests and queued jobs.
Keep in mind that this is [a specific setting for this app](https://github.com/heroku-examples/node-articles-nlp/blob/ff581ec20b843e9c37c5ccdc6d1a175396311531/lib/server.js#L28),
as `THRIFTY` is not a standard Heroku configuration.

Of course, a production app should never run in a single instance or make users wait for worker processes.
When you're ready to test in staging or deploy to production, you can scale beyond single-dyno mode:

```
heroku config:unset THRIFTY
heroku ps:scale web=2 worker=2
```

#### Locally

`npm start` runs [node-foreman](http://strongloop.github.io/node-foreman/),
which will check the [Procfile](https://github.com/heroku-examples/node-articles-nlp/blob/master/Procfile)
and start a single web process and a single worker process.

To test that your app behaves correctly when clustered in multiple processes,
you can [specify process scales](https://github.com/strongloop/node-foreman#advanced-usage) to node-forman
and [set `CONCURRENCY=4`](https://github.com/strongloop/node-foreman#environmental-variables) in a local .env file.

## Architecture

Writing maintainable Node apps is all about separating concerns into small, well-defined modules.
This barebones app has three distinct components with their own responsibilities:

#### App

The business logic is all in [lib/app](https://github.com/heroku-examples/node-articles-nlp/tree/master/lib/app).
This module orchestrates and provides a facade for the underlying
MongoDB database and the RabbitMQ job queue.

#### Web

The user-facing portion of the project lies in [lib/web](https://github.com/heroku-examples/node-articles-nlp/tree/master/lib/web).
This module is responsible for providing an http interface and routing requests.
It *shows* things and relies on an App instance to *do* things.

#### Worker

The background processes run through [lib/worker](https://github.com/heroku-examples/node-articles-nlp/blob/master/lib/worker.js).
This module is tiny - it just instantiates an App instance to process the job queue.
