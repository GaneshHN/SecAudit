class SecureIPCProcessor {
  constructor(context, eventPublisher) {
    this.context = context;
    this.eventPublisher = eventPublisher;
    this.maxMessageSizeBytes = 10 * 1024; // 10KB
    this.buffer = '';
  }

  processChunk(data) {
    this.buffer += data.toString();
    
    // Prevent unbounded buffering (e.g. infinite stdout without newline)
    if (this.buffer.length > this.maxMessageSizeBytes * 10) {
      throw this._createError('IPCProtocolViolation', 'Stdout buffer overflow (missing newlines).');
    }

    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;

      if (Buffer.byteLength(line, 'utf8') > this.maxMessageSizeBytes) {
        throw this._createError('IPCProtocolViolation', 'IPC message size exceeded.');
      }

      let msg;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        console.error(`[SecureIPCProcessor] Malformed JSON: ${line}`);
        throw this._createError('IPCProtocolViolation', 'Malformed JSON in IPC stream.');
      }

      if (!msg || typeof msg !== 'object') {
        console.error(`[SecureIPCProcessor] Not an object: ${line}`);
        throw this._createError('IPCProtocolViolation', 'IPC message must be an object.');
      }

      if (msg.type === 'lifecycle') {
        const allowedEvents = ['ScannerStarted', 'ScannerFinished', 'ArtifactsWritten'];
        if (!allowedEvents.includes(msg.event)) {
          throw this._createError('IPCProtocolViolation', `Unknown lifecycle event: ${msg.event}`);
        }
        this.eventPublisher(msg.event, this.context);
      } else if (msg.type === 'progress') {
        if (this.context.executionContext && this.context.executionContext.reportProgress) {
          // Schema validation for progress
          if (!msg.stage || (typeof msg.stage !== 'string' && typeof msg.stage !== 'object')) {
            throw this._createError('IPCProtocolViolation', 'Invalid progress stage schema.');
          }
          this.context.executionContext.reportProgress(msg.stage, msg.details || {});
        }
      } else {
        console.error(`[SecureIPCProcessor] Unknown message type: ${line}`);
        throw this._createError('IPCProtocolViolation', `Unknown IPC message type: ${msg.type}`);
      }
    }
  }

  _createError(reason, message) {
    const err = new Error(message);
    err.reason = reason;
    return err;
  }
}

module.exports = SecureIPCProcessor;
