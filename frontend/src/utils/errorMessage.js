export function errorMessage(error, fallback) {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.request && !error.response) {
    return 'Cannot reach the backend. Start the server on http://localhost:5000 and refresh this page.'
  }
  return fallback
}
