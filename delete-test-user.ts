import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'bootcamp_access',
});

async function deleteTestUser() {
  await dataSource.initialize();
  
  // First delete related records
  await dataSource.query("DELETE FROM access_request_items WHERE \"accessRequestId\" IN (SELECT id FROM access_requests WHERE \"targetUserId\" = '3a6f2e2d-6da5-4d1b-9a40-5b985e04af48' OR \"requesterId\" = '3a6f2e2d-6da5-4d1b-9a40-5b985e04af48')");
  await dataSource.query("DELETE FROM access_requests WHERE \"targetUserId\" = '3a6f2e2d-6da5-4d1b-9a40-5b985e04af48' OR \"requesterId\" = '3a6f2e2d-6da5-4d1b-9a40-5b985e04af48'");
  await dataSource.query("DELETE FROM access_grants WHERE \"userId\" = '3a6f2e2d-6da5-4d1b-9a40-5b985e04af48'");
  await dataSource.query("DELETE FROM system_owners WHERE \"userId\" = '3a6f2e2d-6da5-4d1b-9a40-5b985e04af48'");
  
  // Delete the user
  await dataSource.query("DELETE FROM users WHERE id = '3a6f2e2d-6da5-4d1b-9a40-5b985e04af48'");
  
  console.log('Test user (sadyageraldm@gmail.com) deleted!');
  await dataSource.destroy();
}

deleteTestUser().catch(console.error);
