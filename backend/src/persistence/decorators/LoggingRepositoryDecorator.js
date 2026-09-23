const BaseRepositoryDecorator = require('./BaseRepositoryDecorator');

class LoggingRepositoryDecorator extends BaseRepositoryDecorator {
  constructor(repository, repositoryName) {
    super(repository);
    this.repositoryName = repositoryName;
    
    const proxy = new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof repository[prop] === 'function' && prop !== 'checkHealth') {
          return async (...args) => {
            // console.log(`[${repositoryName}] Executing ${prop.toString()}...`);
            try {
              const result = await repository[prop].apply(repository, args);
              // console.log(`[${repositoryName}] Successfully executed ${prop.toString()}.`);
              return result;
            } catch (err) {
              console.error(`[${repositoryName}] Error executing ${prop.toString()}:`, err.message);
              throw err;
            }
          };
        }
        return Reflect.get(target, prop, receiver) || Reflect.get(repository, prop);
      }
    });
    return proxy;
  }
}

module.exports = LoggingRepositoryDecorator;
