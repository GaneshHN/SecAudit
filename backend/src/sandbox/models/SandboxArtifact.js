class SandboxArtifact {
  constructor(options = {}) {
    this.type = options.type;
    this.filename = options.filename;
    this.size = options.size;
    this.content = options.content;
  }
}

module.exports = SandboxArtifact;
