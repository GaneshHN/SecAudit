const EventEmitter = require('events');

class CancellationToken extends EventEmitter {
  constructor() {
    super();
    this._cancelled = false;
    this._reason = null;
  }

  cancel(reason = 'Operation cancelled') {
    if (this._cancelled) return; // Prevent multiple cancellations
    this._cancelled = true;
    this._reason = reason;
    this.emit('cancelled', reason);
  }

  get isCancelled() {
    return this._cancelled;
  }

  get reason() {
    return this._reason;
  }

  throwIfCancelled() {
    if (this._cancelled) {
      const error = new Error(this._reason);
      error.isCancellation = true;
      throw error;
    }
  }
}

module.exports = CancellationToken;
