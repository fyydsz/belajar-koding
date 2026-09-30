import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth';
import { profileRoutes } from './routes/profile';
import { gradeRoutes } from './routes/grades';
import { assignmentRoutes } from './routes/assignments';
import { botRoutes } from './routes/bot';
import 'dotenv/config';

const port = Number(process.env.PORT) || 3001;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

export const app = new Elysia()
  .use(
    cors({
      origin: [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Bot-Secret'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    })
  )
  .use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'Belajar Koding SIAKAD & E-Learning API',
          version: '1.0.0',
          description: 'Backend API untuk sistem pembelajaran, SIAKAD, dan bot pengumpulan tugas Discord',
        },
      },
    })
  )
  .get('/health', () => ({
    status: 'ok',
    service: 'belajar-koding-server',
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .use(profileRoutes)
  .use(gradeRoutes)
  .use(assignmentRoutes)
  .use(botRoutes)
  .listen(port);

console.log(`🦊 Elysia backend server is running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Swagger documentation available at http://localhost:${port}/swagger`);
