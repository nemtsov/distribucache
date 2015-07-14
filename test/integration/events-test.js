var sinon = require('sinon'),
  stub = sinon.stub,
  should = require('should'),
  w = require('../helpers/wrap'),
  dcache = require('../../'),
  slice = Array.prototype.slice,
  EVENT_NAMES = [
    // GET
    'get:before', 'get:stale', 'get:expire',
    'get:hit', 'get:miss', 'get:after', 'get:error',

    // SET
    'set:before', 'set:identical', 'set:after', 'set:error',

    // DEL
    'del:before', 'del:after', 'del:error',

    // POPULATE
    'populate:before', 'populate:after', 'populate:error',

    // POPULATE_IN
    'populateIn:before', 'populateIn:pause', 'populateIn:maxAttempts',
    'populateIn:after', 'populateIn:error'
  ];

describe('integration/events', function () {
  var cache, client, store, events, clock;

  beforeEach(function () {
    function noop() {}
    store = stub({
      createLease: noop,
      createTimer: noop,
      on: noop,
      del: noop,
      expire: noop,
      getProp: noop,
      setProp: noop,
      depProp: noop,
      incrPropBy: noop
    });
    clock = sinon.useFakeTimers();
    client = dcache.createClient(store);
  });

  afterEach(function () {
    clock.restore();
  });

  function createCache() {
    cache = client.create.apply(client, arguments);
    events = {};
    EVENT_NAMES.forEach(function (name) {
      cache.on(name, function () {
        if (!events[name]) events[name] = {callCount: 0, args: []};
        events[name].callCount++;
        events[name].args.push(slice.call(arguments));
      });
    });
  }

  describe('get', function () {
    beforeEach(createCache.bind(null, 'n'));

    it('should emit `miss` if value is null', function (done) {
      store.getProp.withArgs('n:k').yields(null, null, 'e');

      function verify(value) {
        arguments.length.should.equal(1);
        should(value).not.be.ok();
        Object.keys(events).should.eql([
          'get:before', 'get:after', 'get:miss'
        ]);
        events.should.eql({
          'get:before': {callCount: 1, args: [['k']]},
          'get:after': {callCount: 1, args: [['k', 0]]},
          'get:miss': {callCount: 1, args: [['k']]}
        });
      }

      cache.get('k', w(verify, done));
    });

    it('should emit hit event if value is not null', function (done) {
      store.getProp.withArgs('n:b').yields(null, '"v"', 'e');

      function verify(value) {
        arguments.length.should.equal(1);
        should(value).be.ok();
        Object.keys(events).should.eql([
          'get:before', 'get:after', 'get:hit'
        ]);
        events.should.eql({
          'get:before': {callCount: 1, args: [['b']]},
          'get:after': {callCount: 1, args: [['b', 0]]},
          'get:hit': {callCount: 1, args: [['b']]}
        });
      }

      cache.get('b', w(verify, done));
    });

    describe('with `staleIn` set', function () {
      beforeEach(createCache.bind(null, 'n', {staleIn: 100}));

      it('should emit a `miss` event when cache empty', function (done) {
        store.getProp.withArgs('n:b', 'createdAt').yields(null, null);

        function verify(value) {
          arguments.length.should.equal(1);
          should(value).not.be.ok();
          Object.keys(events).should.eql([
            'get:before', 'get:after', 'get:miss'
          ]);
          events['get:miss'].should.eql({callCount: 1, args: [['b']]});
        }

        cache.get('b', w(verify, done));
      });

      it('should not emit a `stale` event when cache not stale', function (done) {
        store.getProp.withArgs('n:b', 'createdAt').yields(null, Date.now());
        store.getProp.withArgs('n:b', 'value').yields(null, '"v"');

        function verify(value) {
          arguments.length.should.equal(1);
          value.should.equal('v');
          Object.keys(events).should.eql([
            'get:before', 'get:after', 'get:hit'
          ]);
          events.should.eql({
            'get:before': {callCount: 1, args: [['b']]},
            'get:after': {callCount: 1, args: [['b', 0]]},
            'get:hit': {callCount: 1, args: [['b']]}
          });
        }

        cache.get('b', w(verify, done));
      });

      it('should emit a `stale` event when cache empty and get', function (done) {
        store.getProp.withArgs('n:b', 'createdAt').yields(null, Date.now() - 200);
        store.getProp.withArgs('n:b', 'value').yields(null, '"v"');

        function verify(value) {
          arguments.length.should.equal(1);
          value.should.equal('v');
          Object.keys(events).should.eql([
            'get:before', 'get:stale', 'get:after', 'get:hit'
          ]);
          events.should.eql({
            'get:before': {callCount: 1, args: [['b']]},
            'get:stale': {callCount: 1, args: [['b']]},
            'get:after': {callCount: 1, args: [['b', 0]]},
            'get:hit': {callCount: 1, args: [['b']]}
          });
        }

        cache.get('b', w(verify, done));
      });
    });

    describe('with `expireIn` set', function () {
      it('should emit an `get:expire` event and delete the cache when cache expires', function (done) {
        createCache('n', {expiresIn: 100});

        store.getProp.withArgs('n:c', 'createdAt').yields(null, Date.now() - 200);
        store.del.withArgs('n:c').yields(null);

        function verify(value) {
          arguments.length.should.equal(1);
          should(value).not.be.ok();
          //Object.keys(events).should.eql(['expire', 'del', 'miss']);
          Object.keys(events).should.eql([
            'get:before', 'get:expire',
            'del:before', 'del:after',
            'get:after', 'get:miss'
          ]);
          events['get:expire'].should.eql({callCount: 1, args: [['c']]});
          events['del:before'].should.eql({callCount: 1, args: [['c']]});
          events['del:after'].should.eql({callCount: 1, args: [['c', 0]]});
        }

        cache.get('c', w(verify, done));
      });
    });
  });

  describe('set', function () {
    beforeEach(createCache.bind(null, 'n'));

    it('should emit set events and ignore extra store args', function (done) {
      store.getProp.withArgs('n:k', 'hash').yields(null, 'h', 'e');
      store.setProp.withArgs('n:k', 'value').yields(null, 'e');

      function verify() {
        arguments.length.should.equal(0);
        Object.keys(events).should.eql(['set:before', 'set:after']);
        events['set:before'].should.eql({callCount: 1, args: [['k', 'v']]});
        events['set:after'].should.eql({callCount: 1, args: [['k', 'v', 0]]});
      }

      cache.set('k', 'v', w(verify, done));
    });

    it('should emit set and set:identical if hash is the same', function (done) {
      store.getProp.withArgs('n:s', 'hash').yields(null, '59b943d2fe6aede1820f470ac1e94e1a');
      store.setProp.withArgs('n:s', 'value').yields(null);

      function verify() {
        arguments.length.should.equal(0);
        Object.keys(events).should.eql(['set:before', 'set:identical', 'set:after']);
        events['set:before'].should.eql({callCount: 1, args: [['s', 'v']]});
        events['set:identical'].should.eql({callCount: 1, args: [['s']]});
      }

      cache.set('s', 'v', w(verify, done));
    });
  });
});
