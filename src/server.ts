import express from 'express'
import morgan from 'morgan'
import connectDB from './config/db'
import dotenv from 'dotenv'
import authRouter from './routes/authRouter'
import productRouter from './routes/productRouter'
import categoryRouter from './routes/categoryRouter'
import cartRouter from './routes/cartRouter'
import orderRouter from './routes/orderRouter'
import checkoutRouter from './routes/checkoutRouter'
import saleRouter from './routes/saleRouter'
import webhookRouter from './routes/webhookRouter'
import userRouter from './routes/userRouter'
import purchaseRouter from './routes/purchaseRouter'
import brandRouter from './routes/brandRouter'

//Cors
import cors from 'cors'
import { globalErrorHandler } from './middleware/error.middleware'
import lineRouter from './routes/line.router'

// v2
import productRouterV2 from './modules/product/product.routes'
import saleRouterV2 from './modules/sale/sale.routes'
import cashRouter from './modules/cash/cash.routes'
import reportRouter from './modules/reports/report.routes'
import sliderBannerRouter from './modules/sliderbanner/sliderbanner.routes'
import userRouterV2 from './modules/users/users.router'
import orderRouterV2 from './modules/order/order.router' 
import webhookRouterV2 from './modules/webhook/webhook.router' 
import sectionRouter from './modules/section/section.router'
import advertisementRouter from './modules/advertisement/advertisement.routes'

import setupSwagger from './config/swagger.config'
import collectionRouter from './modules/collection/collection.router'
import comparisonRouter from './modules/comparison/comparison.router'
import mediaRouter from './modules/media/media.routes';
import claimRouter from './modules/claim/claim.routes';

// Importación del Seeder
import { seedSystemCollections } from './seeds/systemCollections'

dotenv.config()

const app = express()

// Ejecución controlada y asíncrona del seed tras conectar con éxito
connectDB()
    .then(async () => {
        try {
            await seedSystemCollections();
            console.log('Colecciones del sistema verificadas/inicializadas correctamente.');
        } catch (seedError) {
            console.error('Error ejecutando el seed de colecciones:', seedError);
        }
    })
    .catch((dbError) => {
        console.error('Error crítico en la cadena de conexión:', dbError);
    });

// ════════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN DE PARSERS Y MIDDLEWARES DE ENTRADA CRÍTICOS
// ════════════════════════════════════════════════════════════════
app.use(morgan('dev'))

// El interceptor intercepta los bytes exactos antes de que se limpie el stream de la petición HTTP
app.use(express.json());

app.use(express.urlencoded({ extended: true }))

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

// ════════════════════════════════════════════════════════════════
// 2. WEBHOOKS Y ENRUTADORES ASÍNCRONOS
// ════════════════════════════════════════════════════════════════
app.use('/api/webhooks/v2', webhookRouterV2)
app.use('/api/webhooks', webhookRouter)

app.get('/', (req, res) => {
    res.send('API is running...')
})

setupSwagger(app)

// ════════════════════════════════════════════════════════════════
// 3. RUTAS DE MÓDULOS VERSION 2
// ════════════════════════════════════════════════════════════════
app.use('/api/products/v2', productRouterV2)
app.use('/api/sales/v2', saleRouterV2)
app.use('/api/cash/v2', cashRouter)
app.use('/api/reports/v2', reportRouter)
app.use('/api/users/v2', userRouterV2)
app.use('/api/orders/v2', orderRouterV2) 
app.use('/api/slider-banners', sliderBannerRouter)
app.use('/api/sections', sectionRouter)
app.use('/api/collections', collectionRouter)
app.use('/api/comparisons', comparisonRouter)
app.use('/api/media', mediaRouter)
app.use('/api/claims', claimRouter)
app.use('/api/advertisements', advertisementRouter)

// ════════════════════════════════════════════════════════════════
// 4. RUTAS VERSION 1 / LEGADO
// ════════════════════════════════════════════════════════════════
app.use('/api/auth', authRouter)
app.use('/api/users', userRouter)
app.use('/api/category', categoryRouter)
app.use('/api/brands', brandRouter)
app.use('/api/products', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/orders', orderRouter)
app.use('/api/checkout', checkoutRouter)
app.use('/api/sales', saleRouter)
app.use('/api/lines', lineRouter)
app.use('/api/purchases', purchaseRouter)

// Middleware global para captura de errores
app.use(globalErrorHandler);

export default app