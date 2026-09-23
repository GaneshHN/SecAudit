class ProgressSnapshot {
  constructor({
    stageId = 'QUEUED',
    stageName = 'Queued',
    progressPercentage = 0,
    filesProcessed = 0,
    totalFiles = 0,
    currentFile = null,
    estimatedRemainingTime = 0
  }) {
    this.stageId = stageId;
    this.stageName = stageName;
    this.progressPercentage = progressPercentage;
    this.filesProcessed = filesProcessed;
    this.totalFiles = totalFiles;
    this.currentFile = currentFile;
    this.estimatedRemainingTime = estimatedRemainingTime; // in seconds
  }
}

module.exports = ProgressSnapshot;
