'use strict';

const config = {
  delay: 1500,
  timeout: 10000, //for fastly-promises client
  maxConcurrentSize: 10,
  token: 'fastly_api_token',
  body: {
    shield: 'dca-dc-us'
  },
  affected(backend) {
    return backend.shield === 'iad-va-us';
  }
};

module.exports = config;
