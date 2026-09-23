const BaseRepositoryDecorator = require('./BaseRepositoryDecorator');
const { defaultEventBus } = require('../../events/LocalEventBus');
const BaseEvent = require('../../events/BaseEvent');
const { OptimisticLockException } = require('../exceptions/RepositoryExceptions');
const { EventCategory } = require('../../events/EventCategory');

class EventPublishingRepositoryDecorator extends BaseRepositoryDecorator {
  constructor(repository, entityName) {
    super(repository);
    this.entityName = entityName;
    
    const proxy = new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof repository[prop] === 'function' && prop !== 'checkHealth') {
          return async (...args) => {
            try {
              const result = await repository[prop].apply(repository, args);
              
              if (prop === 'save' || prop === 'saveEvent') {
                const isUpdate = args[0] && args[0].version > 1;
                const eventName = isUpdate ? 'EntityUpdated' : 'EntityCreated';
                
                defaultEventBus.publish(new BaseEvent({
                  eventType: eventName,
                  jobId: args[0] ? args[0].id || args[0].jobId : 'unknown',
                  category: EventCategory.SYSTEM,
                  sourceComponent: `${entityName}Repository`,
                  payload: { entity: entityName, action: eventName, dataId: args[0] ? args[0].id : null }
                }));
              } else if (prop === 'delete') {
                defaultEventBus.publish(new BaseEvent({
                  eventType: 'EntityDeleted',
                  jobId: args[0] || 'unknown',
                  category: EventCategory.SYSTEM,
                  sourceComponent: `${entityName}Repository`,
                  payload: { entity: entityName, action: 'EntityDeleted', dataId: args[0] }
                }));
              }

              return result;
            } catch (err) {
              if (err instanceof OptimisticLockException) {
                defaultEventBus.publish(new BaseEvent({
                  eventType: 'OptimisticLockFailed',
                  jobId: err.entityId || 'unknown',
                  category: EventCategory.SYSTEM,
                  sourceComponent: `${entityName}Repository`,
                  payload: { entity: entityName, action: 'OptimisticLockFailed', dataId: err.entityId, expected: err.expectedVersion, actual: err.actualVersion }
                }));
              }
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

module.exports = EventPublishingRepositoryDecorator;
