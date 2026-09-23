// Centralized constants for the application

module.exports = {
  // Max upload sizes
  MAX_FILE_SIZE_BYTES: 500 * 1024 * 1024, // 500MB
  
  // Timeout settings
  TIMEOUTS: {
    URL_CHECK_MS: 15_000,
    DOWNLOAD_MS: 120_000,
  },
  
  // HTTP Methods
  HTTP_METHODS: {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
  },
};
