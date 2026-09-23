const BaseRepositoryDecorator = require('./BaseRepositoryDecorator');
const { defaultEventBus } = require('../../events/LocalEventBus');
const BaseEvent = require('../../events/BaseEvent');
const { EventCategory } = require('../../events/EventCategory');

class MetricsRepositoryDecorator extends BaseRepositoryDecorator {
  constructor(repository, repositoryName) {
    super(repository);
    this.repositoryName = repositoryName;
    
    // We override specific known methods dynamically if they exist on the target
    const proxy = new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof repository[prop] === 'function' && prop !== 'checkHealth') {
          return async (...args) => {
            const start = Date.now();
            let success = true;
            try {
              return await repository[prop].apply(repository, args);
            } catch (err) {
              success = false;
              throw err;
            } finally {
              const duration = Date.now() - start;
              const isRead = prop.toString().startsWith('get') || prop.toString().startsWith('query') || prop.toString().startsWith('list');
              
              // Publish metric event passively
              defaultEventBus.publish(new BaseEvent({
                eventType: 'RepositoryOperationCompleted',
                category: EventCategory.SYSTEM,
                sourceComponent: repositoryName || 'UnknownRepository',
                payload: {
                  operation: isRead ? 'read' : 'write',
                  method: prop.toString(),
                  latencyMs: duration,
                  success
                }
              })).catch(err => {
                console.error(`[MetricsRepositoryDecorator] Failed to publish metrics for ${repositoryName}:`, err.message);
              });
            }
          };
        }
        return Reflect.get(target, prop, receiver) || Reflect.get(repository, prop);
      }
    });
    return proxy;
  }
}

module.exports = MetricsRepositoryDecorator;
