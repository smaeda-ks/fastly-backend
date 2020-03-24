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
          const affected = backends.data.filter(config.affected);
          
          if (!affected.length) return;
  
          console.log(`Updating serivce: ${id}`);
          
          const clone = await service.cloneVersion(active.number);
          await Promise.all(affected.map(backend => {
            service.updateBackend(clone.data.number, backend.name, config.body)
              .catch(err => {
                console.log(`Error (id: ${id}): ${err.message}`);
                return
            });
          }));
          await service.activateVersion(clone.data.number);
          
          console.log(`Updated service: ${id}, version: ${clone.data.number}`);
          
          await sleep(config.delay);
        } catch (err) {
        console.log(`Error (id: ${id}) ${err.message}`);
        }
      }));
      promiseIndex += maxConcurrentSize;
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
})();
