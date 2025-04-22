import express from 'express' 
import morgan from 'morgan'
import connectDB from './config/db'
import dotenv from 'dotenv'
import authRouter from './routes/authRouter'
import productRouter from './routes/productRouter'
import categoryRouter from './routes/categoryRouter'
import cartRouter from './routes/cartRouter'
import orderRouter from './routes/orderRouter'

// Connect to MongoDB

dotenv.config()

const app = express()

connectDB()

app.use(morgan('dev'))
app.use(express.json())

app.get('/', (req, res) => {
    res.send('API is running...')
})

// Router
app.use('/api/auth', authRouter)
app.use('/api/category', categoryRouter)
app.use('/api/products', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/orders', orderRouter)



export default app