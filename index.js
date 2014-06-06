'use strict';

var metroplex = module.exports;

/**
 * Add defaults to the supplied options. The following options are available:
 *
 * - redis: The redis instance we should use to store data
 * - namespace: The namespace prefix to prevent collision's.
 * - interval: Expire interval to keep the server alive in redis
 * - timeout: Timeout for sparks who are alive.
 * - latency: Time it takes for our redis commands to execute.
 *
 * @param {Primus} primus The Primus instance that received the plugin.
 * @param {Object} options Configuration.
 * @returns {Object} Options.
 * @api public
 */
metroplex.options = function optional(primus, options) {
  var address = primus.server.address();

  options = options || {};

  options.redis = options.redis || require('redis').createClient();
  options.namespace = options.namespace || 'metroplex';
  options.interval = options.interval || 5 * 60 * 1000;
  options.timeout = options.timeout || 30 * 60;
  options.latency = options.latency || 2000;

  return options;
};

/**
 * Keep the precense or "state" of each connection in Redis.
 *
 * @param {Primus} primus The Primus instance that received the plugin.
 * @param {Object} options The options that were supplied to Primus.
 * @api public
 */
metroplex.server = function server(primus, options)  {
  options = metroplex.options(primus, options);

  var namespace = options.namespace +':'
    , address = options.address
    , redis = options.redis;

  primus.on('connection', function connection(spark) {
    redis.setex(namespace +':spark:'+ spark.id, options.timeout, address);
  }).on('disconnection', function disconnection(spark) {
    redis.del(namespace +':spark:'+ spark.id, options.timeout, address);
  });

  primus.on('close', function close() {
    redis.del(namespace +':'+ address);
    clearInterval(alive);
  }).server.on('listening', function listening() {
    var address = 'http://localhost:'+ primus.server.address().port;

    //
    // We can only get the server's port number when the server starts
    // listening. So if our address is still undefined, it's only now that we
    // can provide a default value.
    //
    options.address = options.address || address;
  });

  if (primus.server.address()) {
    redis.setex(namespace +':'+ address, options.interval);
  }

  //
  // We need to make sure that this server is alive, the most easy and dirty way
  // of doing this is setting an interval which bumps the expire of our
  // dedicated server key. If we go off line, the key will expire and we will be
  // K.O.
  //
  var alive = setInterval(function interval() {
    redis.expire(namespace +':'+ address, options.interval);
  }, options.interval - options.latency);
};
