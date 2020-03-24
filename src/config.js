'use strict';

const config = {
  delay: 3000,
  timeout: 10000, //for fastly-promises client
  token: 'fastly_api_token',
  body: {
    shield: 'mdw-il-us'
  },
  affected(backend) {
    return backend.shield === 'ord-il-us';
  }
};

module.exports = config;
