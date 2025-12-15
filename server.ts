import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' }); // fallback
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { setupSocket } from './src/server/socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
// Keep Next.js, socket.io, and the client on the same port to avoid mismatched origins
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    // Initialize Socket.io with permissive CORS so file:// or iframe hosts can connect
    const io = new Server(server, {
        cors: {
            origin: '*',
        },
    });

    // Setup Socket Logic
    setupSocket(io);

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
