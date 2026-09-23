class BaseRepositoryDecorator {
  constructor(repository) {
    this.repository = repository;

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }
        if (Reflect.has(repository, prop)) {
          const val = Reflect.get(repository, prop);
          if (typeof val === 'function') {
            return val.bind(repository);
          }
          return val;
        }
        return undefined;
      }
    });
  }
}

module.exports = BaseRepositoryDecorator;
