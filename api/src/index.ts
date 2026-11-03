import { Hono } from 'hono'
import { ApiError } from './errors'
import { bills } from './routes/bills'
import { homes } from './routes/homes'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.route('/api', homes)
app.route('/api', bills)

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.message }, error.status)
  }
  // Unknown errors are logged but never leak details to the client.
  console.error(error)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
