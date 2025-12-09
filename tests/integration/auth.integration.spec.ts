import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthModule } from '../../src/auth/auth.module';

describe('Auth (Integration)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'manager@example.com', password: 'password' })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe('manager');
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'manager@example.com', password: 'wrong' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user when token is valid', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'owner@example.com', password: 'password' })
        .expect(201);

      const token = login.body.token;

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .query({ token })
        .expect(200);

      expect(res.body.role).toBe('owner');
      expect(res.body.email).toBe('owner@example.com');
    });

    it('should reject missing token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });
});

