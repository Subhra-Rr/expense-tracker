const multer = require('multer')

function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return undefined

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON request body' })
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' })
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Receipt must be 5 MB or smaller' })
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: 'Only one receipt file can be uploaded' })
  }

  console.error('Unhandled request error:', error.message)
  return res.status(500).json({ message: 'Internal server error' })
}

module.exports = errorHandler
