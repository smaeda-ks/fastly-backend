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
          const directors = await service.readDirectors(active.number);
          const affectedBackends = backends.data.filter(config.affected);
          const affectedPools = pools.data.filter(config.affected);
          const affectedDirectors = directors.data.filter(config.affected);

          let clone = null;
          let isPoolsUpdated = false;
          let isBackendsUpdated = false;
          let isDirectorsUpdated = false;
          if (affectedBackends.length || affectedPools.length || affectedDirectors.length) {
            clone = await service.cloneVersion(active.number);
          }

          if (affectedDirectors.length) {
            // versionless objects are shouldn't be updated concurrently
            // ref.NEX-1933
            for (let director of affectedDirectors) {
              await service.updateDirector(clone.data.number, director.name, config.body)
                .then(isDirectorsUpdated = true)
                .catch(err => {
                  console.log(`Error (id: ${id}, director: ${director.name}): ${err.message}`);
                  return
                });
            }
            if (isDirectorsUpdated) console.log(`Updated service (director): ${id}, version: ${clone.data.number}`);
          }

          if (affectedPools.length) {
            // versionless objects are shouldn't be updated concurrently
            // ref.NEX-1933
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
          
          if (clone !== null && (isPoolsUpdated || isBackendsUpdated || isDirectorsUpdated)) {
            // add version comment
            await service.updateVersion(clone.data.number, config.versionComment);
            await sleep(1000);
            // activate new version
            // if fails, probably there's custom VCL/snippets that include shielding definition
            await service.activateVersion(clone.data.number)
              .then(console.log(`Activated service (success): ${id}, version: ${clone.data.number}`))
              .catch(err => {
                console.log(`Error (id: ${id}, failed activating version: ${clone.data.number}): ${err.message}`);
              });

          }

          await sleep(config.delay);
        } catch (err) {
        console.log(`Error (id: ${id}, needs retry?): ${err.message}`);
        }
      }));
      promiseIndex += maxConcurrentSize;
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
})();
