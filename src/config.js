'use strict';

const config = {
  delay: 5000,
  timeout: 10000,
  maxConcurrentSize: 10,
  token: 'fastly_api_token',
  versionComment: {
    comment: '!!! DO NOT REVERT - Configuration updates for shielding migration. Contact Fastly support for more details !!! Please do not revert these changes, and only clone from this version going forward.'
  },
  body: {
    shield: 'dca-dc-us' //new shielding location
  },
  affected(backend) {
    return backend.shield === 'iad-va-us'; //old shielding location
  }
};

module.exports = config;
