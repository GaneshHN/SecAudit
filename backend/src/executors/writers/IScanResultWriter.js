class IScanResultWriter {
  /**
   * Write the scan result.
   * @param {Object} context ExecutionContext
   * @param {Object} report Scan report
   * @returns {Promise<void>}
   */
  async write(context, report) {
    throw new Error('Method not implemented.');
  }
}

module.exports = IScanResultWriter;
