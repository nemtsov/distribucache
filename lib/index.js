var Cache = require('./Cache'),
  ExpireDecorator = require('./decorators/ExpireDecorator'),
  PopulateDecorator = require('./decorators/PopulateDecorator'),
  PopulateInDecorator = require('./decorators/PopulateInDecorator');

/**
 * Create a new Cache, decorated
 * with the desired features,
 * based on the provided config.
 *
 * @param {Object} [config]
 *
 * @param {String} [config.host] defaults to 'localhost'
 * @param {Number} [config.port] defaults to 6379
 * @param {String} [config.password]
 * @param {String} [config.namespace]
 *
 * @param {String} [config.expiresIn] in ms
 *
 * @param {Function} [config.populate]
 * @param {Number} [config.populateTimeout] in ms, defaults to 30sec
 *
 * @param {String} [config.staleIn] in ms
 */

exports.create = function (config) {
  var cache;

  config = config || {};

  cache = new Cache({
    host: config.host,
    port: config.port,
    password: config.password,
    namespace: config.namespace
  });

  if (config.expiresIn || config.staleIn) {
    cache = new ExpireDecorator(cache, {
      expiresIn: config.expiresIn,
      staleIn: config.staleIn
    });
  }

  if (config.populate) {
    cache = new PopulateDecorator(cache, {
      populate: config.populate
    });

    if (config.populateIn) {
      cache = new PopulateInDecorator(cache, {
        populateIn: config.populateIn,
        leaseTimeout: config.leaseTimeout,
        namespace: config.namespace
      });
    }
  }

  return cache;
};