var util = require('./_all').util;

describe('util', function () {
  describe('createHash', function () {
    it('should create the same hash for the same value', function () {
      util.createHash('a').should.eql(util.createHash('a'));
    });

    it('should create a different hash for different values', function () {
      util.createHash('a').should.not.eql(util.createHash('b'));
    });
  });

  describe('completeWithin', function () {
    it('should yield an TimeoutError if cb takes longer than timeout', function (done) {
      function longTime(cb) {
        setTimeout(function () {
          cb(null);
        }, 3);
      }

      function onReady(err) {
        err.name.should.equal('TimeoutError');
        done();
      }

      longTime(util.completeWithin(1, onReady));
    });

    it('should call the `done` before timeout', function (done) {
      function longTime(cb) {
        setTimeout(function () {
          cb(null);
        }, 3);
      }
      longTime(util.completeWithin(6, done));
    });
  });

  describe('intervalToMs', function () {
    it('should return the input if not a string', function () {
      util.intervalToMs(100).should.equal(100);
    });

    it('should return the input if the input does not match the re', function () {
      util.intervalToMs('hello').should.equal('hello');
    });

    it('should parse and transform various formats', function () {
      var tests = ['1ms', '10 ms', '3 sec', '3 seconds',
        '1min', '1 minute', '1 hour', '1 day', '1 week',
        '1 month', '10 years'];
      tests.forEach(function (test) {
        util.intervalToMs(test).should.be.type('number');
      });
    });

    it('should understand floats', function () {
      util.intervalToMs('1.5 seconds').should.equal(1500);
    });
  });
});