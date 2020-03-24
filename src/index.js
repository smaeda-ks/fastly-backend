'use strict';

let ids = require('./ids');
const sleep = require('./sleep');
const config = require('./config');
//use local version (submodule)
const fastly = require('./fastly-promises');

(async () => {
  try {
    if (!ids.length) {
      const services = await fastly(config.token).readServices();
      ids = services.data.map(service => service.id);
    }
    
    let promiseIndex = 0;
    const maxConcurrentSize = config.maxConcurrentSize || 10;

    while (true) {
      const chunks = ids.slice(promiseIndex, maxConcurrentSize + promiseIndex);
      if (chunks.length === 0) break;
      await Promise.all(chunks.map( async (id) => {
        try {
          const service = fastly(config.token, id);
          service.request.defaults.timeout = config.timeout;
  
          const active = (await service.getActiveVersion()).data;
          const backends = await service.readBackends(active.number);
          const pools = await service.readPools(active.number);
          const affectedBackends = backends.data.filter(config.affected);
          const affectedPools = pools.data.filter(config.affected);
          
          let clone = null;
          let isPoolsUpdated = false;
          let isBackendsUpdated = false;
          if (affectedBackends.length || affectedPools.length) {
            clone = await service.cloneVersion(active.number);
          }

          if (affectedPools.length) {
            //versionless objects are shouldn't be updated concurrently
            //ref.NEX-1933
            for (let pool of affectedPools) {
              await service.updatePool(clone.data.number, pool.name, config.body)
                .then(isPoolsUpdated = true)
                .catch(err => {
                  console.log(`Error (id: ${id}, pool: ${pool.name}): ${err.message}`);
                  return
                });
            }
            if (isPoolsUpdated) console.log(`Updated service (pools): ${id}, version: ${clone.data.number}`);
          }

          if (affectedBackends.length) {
            // const clone = await service.cloneVersion(active.number);
            await Promise.all(affectedBackends.map(backend => {
              service.updateBackend(clone.data.number, backend.name, config.body)
                .then(isBackendsUpdated = true)
                .catch(err => {
                  console.log(`Error (id: ${id}, backend: ${backend.name}): ${err.message}`);
                  return
              });
            }));
            if (isBackendsUpdated) console.log(`Updated service (backends): ${id}, version: ${clone.data.number}`);
          }
          
          if (clone !== null && (isPoolsUpdated || isBackendsUpdated)) {
            await service.activateVersion(clone.data.number);
          }

          await sleep(config.delay);
        } catch (err) {
        console.log(`Error (id: ${id}, needs retry): ${err.message}`);
        }
      }));
      promiseIndex += maxConcurrentSize;
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
})();
