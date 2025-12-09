import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

describe('Database Connection (Integration)', () => {
  let dataSource: DataSource;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'bootcamp_access',
          autoLoadEntities: true,
          synchronize: false, // Don't sync in tests
          logging: false,
        }),
      ],
    }).compile();

    // Get DataSource using getDataSourceToken (default connection)
    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    // Give time for connections to close
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('should connect to PostgreSQL database', async () => {
    expect(dataSource).toBeDefined();
    expect(dataSource.isInitialized).toBe(true);
  });

  it('should be able to query the database', async () => {
    const result = await dataSource.query('SELECT 1 as test');
    expect(result).toBeDefined();
    expect(result[0].test).toBe(1);
  });
});
