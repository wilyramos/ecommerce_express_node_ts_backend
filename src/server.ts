import express from 'express' 
import morgan from 'morgan'
import connectDB from './config/db'
import dotenv from 'dotenv'
import authRouter from './routes/authRouter'

// Connect to MongoDB

dotenv.config()

const app = express()

connectDB()

app.use(morgan('dev'))
app.use(express.json())

// Router
app.use('/api/auth', authRouter)



export default app