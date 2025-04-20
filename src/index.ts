import colors from 'colors'
import server from './server'

const port = process.env.PORT || 4000

server.listen(port, () => {
    console.log( colors.bgMagenta.bold( `REST API is running on PORT: ${port}`))
})