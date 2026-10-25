import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth';
import { profileRoutes } from './routes/profile';
import { gradeRoutes } from './routes/grades';
import { assignmentRoutes } from './routes/assignments';
import { classroomRoutes } from './routes/classroom';
import { batchRoutes } from './routes/batches';
import { attendanceRoutes } from './routes/attendance';
import { botRoutes } from './routes/bot';
import { storageRoutes } from './routes/storage';
import { auth } from './lib/auth';
import { isAllowedOrigin } from './lib/origins';
import 'dotenv/config';

const port = Number(process.env.PORT) || 3001;

export const app = new Elysia()
  .use(
    cors({
      origin: (request: Request): boolean => isAllowedOrigin(request.headers.get('origin')),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Bot-Secret', 'Cookie'],
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
          description: 'Backend API untuk sistem pembelajaran, SIAKAD, presensi token, dan bot Discord',
        },
      },
    })
  )
  .get('/health', () => ({
    status: 'ok',
    service: 'belajar-koding-server',
    timestamp: new Date().toISOString(),
  }))
  .all('/api/auth/*', ({ request }) => auth.handler(request))
  .use(authRoutes)
  .use(profileRoutes)
  .use(gradeRoutes)
  .use(assignmentRoutes)
  .use(classroomRoutes)
  .use(batchRoutes)
  .use(attendanceRoutes)
  .use(botRoutes)
  .use(storageRoutes)
  .listen(port);

export type App = typeof app;

console.log(`🦊 Elysia backend server is running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`📚 Swagger documentation available at http://localhost:${port}/swagger`);
