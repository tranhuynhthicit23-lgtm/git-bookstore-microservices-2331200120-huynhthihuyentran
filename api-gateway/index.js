import express from 'express';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
app.use(morgan(process.env.LOG_LEVEL === 'debug' ? 'dev' : 'tiny'));

// Proxy API routes
const apiRoutes = {
  '/api/users': 'http://user-service:8001',
  '/api/products': 'http://product-service:8002',
  '/api/orders': 'http://order-service:8003',
  '/': 'http://frontend:3000'
};
for (const [route, target] of Object.entries(apiRoutes)) {
  app.use(
    route,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      // Optionally, you may want to add pathRewrite for more flexible proxies
      // pathRewrite: (path, req) => path,
    })
  );
}

const PORT = 8000;
app.listen(PORT, () => console.log(`API Gateway running on ${PORT}`));
