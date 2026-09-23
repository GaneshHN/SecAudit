class IProgressStrategy {
  /**
   * Calculate progress and state snapshot based on inputs.
   * @param {Object} stage - JobStage object (e.g. JobStage.SCANNING)
   * @param {Object} metrics - metrics from execution (e.g., { filesProcessed, totalFiles })
   * @returns {ProgressSnapshot}
   */
  calculateProgress(stage, metrics) {
    throw new Error('IProgressStrategy subclass must implement calculateProgress');
  }
}

module.exports = IProgressStrategy;
