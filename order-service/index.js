import express from 'express';
import axios from 'axios';
import db from './db.js';
import { connectToBroker, publishMessage } from './broker.js';

const app = express();
app.use(express.json());

// RabbitMQ
connectToBroker().catch(err => console.error('Broker init error', err));

// Create order
app.post('/', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    // 1. Validate request body
    if (!productId || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'productId and positive quantity required' });
    }

    // 2. Call product service to verify product exists
    let product;
    try {
      const response = await axios.get(`http://product-service:8002/${productId}`, { timeout: 2000 });
      product = response.data;
    } catch (err) {
      console.error('Product verification error:', err.code || err.message);
      return res.status(404).json({ error: 'Product not found or service unavailable' });
    }

    // 3. Insert order into database
    const r = await db.query(
      'INSERT INTO orders (product_id, quantity, status) VALUES ($1,$2,$3) RETURNING *',
      [productId, quantity, 'PENDING']
    );
    const order = r.rows[0];

    // 4. Publish order.created event to message broker
    const eventMsg = {
      event: 'order.created',
      orderId: order.id,
      product: { id: product.id, title: product.title, author: product.author },
      quantity: order.quantity
    };
    await publishMessage('order-events', eventMsg);
    console.log('Published order.created event:', eventMsg);

    // 5. Return success response
    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List orders
app.get('/', async (_req, res) => {
  const r = await db.query('SELECT * FROM orders ORDER BY id DESC');
  res.json(r.rows);
});

// Get order by id
app.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(r.rows[0]);
});

const PORT = 8003;
app.listen(PORT, () => console.log(`Order Service running on ${PORT}`));