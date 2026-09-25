function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'expense-tracker-api',
    timestamp: new Date().toISOString(),
  })
}

module.exports = { getHealth }