/**
 * ISubscriber
 * Standard interface for Event Bus subscribers.
 */
class ISubscriber {
  /**
   * Handles an incoming event.
   * @param {BaseEvent} event 
   */
  async handle(event) {
    throw new Error('Method not implemented.');
  }
}

module.exports = ISubscriber;
