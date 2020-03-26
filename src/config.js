'use strict';

const config = {
  delay: 5000,
  timeout: 10000,
  maxConcurrentSize: 10,
  token: 'fastly_api_token',
  body: {
    shield: 'dca-dc-us' //new shielding location
  },
  affected(backend) {
    return backend.shield === 'iad-va-us'; //old shielding location
  }
};

module.exports = config;
