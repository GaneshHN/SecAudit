const IProgressStrategy = require('./IProgressStrategy');
const ProgressSnapshot = require('./ProgressSnapshot');

class StaticProgressStrategy extends IProgressStrategy {
  /**
   * Returns a snapshot based purely on the defined JobStage metadata weight.
   */
  calculateProgress(stage, metrics = {}) {
    if (!stage) throw new Error('Stage must be provided');
    
    return new ProgressSnapshot({
      stageId: stage.id,
      stageName: stage.displayName,
      progressPercentage: stage.weight,
      filesProcessed: metrics.filesProcessed || 0,
      totalFiles: metrics.totalFiles || 0,
      currentFile: metrics.currentFile || null,
      estimatedRemainingTime: metrics.estimatedRemainingTime || 0,
    });
  }
}

module.exports = StaticProgressStrategy;
