const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const connectDatabase = require('./config/database')
const { clientUrl, jwtSecret, mongoUri, nodeEnv, port } = require('./config/env')
const authRoutes = require('./routes/authRoutes')
const accountRoutes = require('./routes/accountRoutes')
const budgetRoutes = require('./routes/budgetRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')
const expenseRoutes = require('./routes/expenseRoutes')
const healthRoutes = require('./routes/healthRoutes')
const incomeRoutes = require('./routes/incomeRoutes')
const recurringRoutes = require('./routes/recurringRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const reportRoutes = require('./routes/reportRoutes')
const savingsGoalRoutes = require('./routes/savingsGoalRoutes')
const transferRoutes = require('./routes/transferRoutes')
const reconciliationRoutes = require('./routes/reconciliationRoutes')
const categoryRoutes = require('./routes/categoryRoutes')
const errorHandler = require('./middleware/errorHandler')
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter')
const { startRecurringScheduler } = require('./utils/recurringScheduler')

const app = express()

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters')
}

if (!mongoUri) {
  throw new Error('MONGODB_URI must be configured')
}

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === clientUrl || (nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      return callback(null, true)
    }

    return callback(new Error('Origin is not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '10kb' }))
app.use('/api', apiLimiter)
app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'expense-tracker-api',
    status: 'ok',
    health: '/api/health',
  })
})
app.use('/api/health', healthRoutes)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/budget', budgetRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/incomes', incomeRoutes)
app.use('/api/recurring', recurringRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/savings-goals', savingsGoalRoutes)
app.use('/api/transfers', transferRoutes)
app.use('/api/reconciliations', reconciliationRoutes)
app.use('/api/categories', categoryRoutes)

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' })
})
app.use(errorHandler)

async function startServer() {
  await connectDatabase()
  app.listen(port, () => {
    console.log(`API server running on http://localhost:${port}`)
    startRecurringScheduler()
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message)
  process.exit(1)
})
