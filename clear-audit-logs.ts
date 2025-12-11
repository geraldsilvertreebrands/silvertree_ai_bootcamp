import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'bootcamp_access',
});

async function clearAuditLogs() {
  await dataSource.initialize();
  await dataSource.query('TRUNCATE TABLE audit_logs CASCADE');
  console.log('Audit logs cleared!');
  await dataSource.destroy();
}

clearAuditLogs().catch(console.error);
