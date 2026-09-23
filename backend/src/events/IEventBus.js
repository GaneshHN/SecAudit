/**
 * IEventBus
 * Centralized, event-driven communication layer.
 * Future implementations could use Redis, RabbitMQ, Kafka.
 */
class IEventBus {
  /**
   * Publishes an event to the bus.
   * @param {BaseEvent} event 
   */
  async publish(event) {
    throw new Error('Method not implemented.');
  }

  /**
   * Subscribes a listener to a specific event type.
   * @param {string} eventType 
   * @param {ISubscriber|Function} subscriber 
   */
  subscribe(eventType, subscriber) {
    throw new Error('Method not implemented.');
  }

  /**
   * Unsubscribes a listener.
   * @param {string} eventType 
   * @param {ISubscriber|Function} subscriber 
   */
  unsubscribe(eventType, subscriber) {
    throw new Error('Method not implemented.');
  }

  /**
   * Listens to an event once.
   * @param {string} eventType 
   * @param {ISubscriber|Function} subscriber 
   */
  once(eventType, subscriber) {
    throw new Error('Method not implemented.');
  }

  /**
   * Registers middleware to process events before delivery.
   * @param {Function} middleware 
   */
  use(middleware) {
    throw new Error('Method not implemented.');
  }
}

module.exports = IEventBus;
