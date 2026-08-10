import express from 'express'
import morgan from 'morgan'
import connectDB from './config/db'
import dotenv from 'dotenv'
import cors from 'cors'

// Middleware y utilidades
import { globalErrorHandler } from './middleware/error.middleware'
import { AppError } from './utils/AppError'

// Rutas v1
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
import lineRouter from './routes/line.router'

// Rutas v2
import productRouterV2 from './modules/product/product.routes'
import saleRouterV2 from './modules/sale/sale.routes'
import cashRouter from './modules/cash/cash.routes'
import reportRouter from './modules/reports/report.routes'
import userRouterV2 from './modules/users/users.router'
import orderRouterV2 from './modules/order/order.router'
import webhookRouterV2 from './modules/webhook/webhook.router'
import sectionRouter from './modules/section/section.router'
import advertisementRouter from './modules/advertisement/advertisement.routes'
import pageRouter from './modules/page/page.routes'
import iconRouter from './modules/icon/icon.routes'
import sliderBannerRouter from './modules/sliderbanner/sliderbanner.routes'
import collectionRouter from './modules/collection/collection.router'
import comparisonRouter from './modules/comparison/comparison.router'
import mediaRouter from './modules/media/media.routes'
import claimRouter from './modules/claim/claim.routes'
import inventoryRouter from './modules/inventory/inventory.router'
import discountRouter from './modules/discount/discount.router'



// Rutas version 3: ultima 08/2026

import productRouterV3 from './modules/product-v3/product.router'

import setupSwagger from './config/swagger.config'
import { seedSystemCollections } from './seeds/systemCollections'
import { initOrderCleanupJob } from './jobs/orderCleanup.job'

dotenv.config()

const app = express()

connectDB()
    .then(async () => {
        try {
            await seedSystemCollections();
            console.log('Colecciones del sistema verificadas/inicializadas correctamente.');
            initOrderCleanupJob();
        } catch (seedError) {
            console.error('Error ejecutando tareas de inicio (seeds/cron):', seedError);
        }
    })
    .catch((dbError) => {
        console.error('Error crítico en la cadena de conexión:', dbError);
    });

app.use(morgan('dev'))
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por restricciones de CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}))

// Webhooks
app.use('/api/webhooks/v2', webhookRouterV2)
app.use('/api/webhooks', webhookRouter)

app.get('/', (req, res) => {
    res.send('API is running...')
})

setupSwagger(app)

// Rutas V3
app.use('/api/products/v3', productRouterV3)

// Rutas V2
app.use('/api/products/v2', productRouterV2)
app.use('/api/sales/v2', saleRouterV2)
app.use('/api/cash/v2', cashRouter)
app.use('/api/reports/v2', reportRouter)
app.use('/api/users/v2', userRouterV2)
app.use('/api/orders/v2', orderRouterV2)
app.use('/api/inventory', inventoryRouter)
app.use('/api/discounts', discountRouter)
app.use('/api/slider-banners', sliderBannerRouter)
app.use('/api/sections', sectionRouter)
app.use('/api/collections', collectionRouter)
app.use('/api/comparisons', comparisonRouter)
app.use('/api/media', mediaRouter)
app.use('/api/claims', claimRouter)
app.use('/api/advertisements', advertisementRouter)
app.use('/api/pages', pageRouter)
app.use('/api/icons', iconRouter)

// Rutas V1
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

// Captura de rutas no encontradas (404)
app.use((req, res, next) => {
    next(new AppError(`No se encontró la ruta ${req.originalUrl} en este servidor.`, 404));
});

// Middleware global de errores
app.use(globalErrorHandler);

export default app;