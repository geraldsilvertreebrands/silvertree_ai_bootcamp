import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'bootcamp_access',
});

async function checkUser() {
  await dataSource.initialize();
  const users = await dataSource.query("SELECT id, email, name FROM users WHERE email LIKE '%sadya%'");
  console.log('Users with sadya in email:', users);
  await dataSource.destroy();
}

checkUser().catch(console.error);
