const EventEmitter = require('events');
const IEventBus = require('./IEventBus');
const BaseEvent = require('./BaseEvent');

/**
 * LocalEventBus
 * An in-memory implementation of IEventBus using Node.js EventEmitter.
 */
class LocalEventBus extends IEventBus {
  constructor() {
    super();
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(500);
    this.middlewares = [];
    this.metrics = {
      publishedEvents: 0,
      processedEvents: 0,
      subscriberFailures: 0,
      droppedEvents: 0,
      totalDeliveryTimeMs: 0,
    };
  }

  use(middleware) {
    if (typeof middleware === 'function') {
      this.middlewares.push(middleware);
    }
  }

  async publish(event) {
    if (!(event instanceof BaseEvent)) {
      this.metrics.droppedEvents++;
      throw new Error('Events must inherit from BaseEvent');
    }

    this.metrics.publishedEvents++;
    
    // Process middlewares
    let currentEvent = event;
    for (const mw of this.middlewares) {
      try {
        currentEvent = await mw(currentEvent);
        if (!currentEvent) {
          // Middleware filtered or dropped the event
          this.metrics.droppedEvents++;
          return false;
        }
      } catch (err) {
        this.metrics.droppedEvents++;
        return false;
      }
    }

    const startProcessing = Date.now();
    
    // We emit asynchronously to truly decouple publishers from subscribers
    setImmediate(() => {
      // Node's emit triggers listeners synchronously, 
      // but we wrap each execution safely.
      const listeners = this.emitter.listeners(currentEvent.eventType);
      
      // Also emit a catch-all for wildcard subscribers (e.g. '*')
      const wildcardListeners = this.emitter.listeners('*');
      
      const allListeners = [...listeners, ...wildcardListeners];

      if (allListeners.length === 0) {
        // No one listening, just record processing
        this.metrics.processedEvents++;
        const endProcessing = Date.now();
        this.metrics.totalDeliveryTimeMs += (endProcessing - startProcessing);
        return;
      }

      for (const listener of allListeners) {
        try {
          // Execute without awaiting to prevent slow subscribers from blocking others
          const result = listener(currentEvent);
          if (result instanceof Promise) {
            result.catch(err => {
              this._handleSubscriberError(err, currentEvent, listener);
            });
          }
        } catch (err) {
          this._handleSubscriberError(err, currentEvent, listener);
        }
      }
      
      this.metrics.processedEvents++;
      const endProcessing = Date.now();
      this.metrics.totalDeliveryTimeMs += (endProcessing - startProcessing);
    });

    return true;
  }

  _handleSubscriberError(err, event, listener) {
    this.metrics.subscriberFailures++;
    // Subscriber failures MUST NOT crash the bus or publisher
    console.error(`[EventBus] Subscriber failure on event ${event.eventType} (${event.eventId}):`, err.message);
    // In a full implementation, we might send this to a Dead Letter Event Queue
  }

  subscribe(eventType, subscriber) {
    let fn = subscriber;
    if (subscriber && typeof subscriber.handle === 'function') {
      fn = subscriber.handle.bind(subscriber);
      // Attach reference for unsubscription
      fn.subscriberRef = subscriber;
    }
    
    if (typeof fn !== 'function') {
      throw new Error('Subscriber must be a function or have a handle() method');
    }

    this.emitter.on(eventType, fn);
  }

  unsubscribe(eventType, subscriber) {
    const listeners = this.emitter.listeners(eventType);
    for (const listener of listeners) {
      if (listener === subscriber || listener.subscriberRef === subscriber) {
        this.emitter.removeListener(eventType, listener);
      }
    }
  }

  once(eventType, subscriber) {
    let fn = subscriber;
    if (subscriber && typeof subscriber.handle === 'function') {
      fn = subscriber.handle.bind(subscriber);
    }
    if (typeof fn !== 'function') {
      throw new Error('Subscriber must be a function or have a handle() method');
    }
    this.emitter.once(eventType, fn);
  }

  getMetrics() {
    const avgDelivery = this.metrics.processedEvents > 0 
      ? (this.metrics.totalDeliveryTimeMs / this.metrics.processedEvents).toFixed(2) 
      : 0;

    return {
      publishedEvents: this.metrics.publishedEvents,
      processedEvents: this.metrics.processedEvents,
      subscriberFailures: this.metrics.subscriberFailures,
      droppedEvents: this.metrics.droppedEvents,
      averageDeliveryTimeMs: parseFloat(avgDelivery),
    };
  }
}

// Singleton export for backward compatibility during refactor
const defaultEventBus = new LocalEventBus();

module.exports = { LocalEventBus, defaultEventBus };
