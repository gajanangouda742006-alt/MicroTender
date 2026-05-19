const mysql = require('mysql2/promise');

async function tryConnect(password) {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: password,
      port: 3306
    });
    return connection;
  } catch (error) {
    console.log(`Failed to connect with password: "${password}" - Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const passwords = ['SD23@#jklz9p', 'GajananG@742006', ''];
  let connection = null;
  for (const pw of passwords) {
    connection = await tryConnect(pw);
    if (connection) {
      console.log(`Successfully connected with password: "${pw}"`);
      break;
    }
  }

  if (!connection) {
    console.error('Could not connect with any password.');
    return;
  }

  try {
    const [dbs] = await connection.query('SHOW DATABASES');
    console.log('Databases:', dbs.map(d => d.Database));

    // Check both potential databases
    for (const dbName of ['dbmstender', 'micro_tender_db']) {
      const dbExists = dbs.some(d => d.Database.toLowerCase() === dbName.toLowerCase());
      if (dbExists) {
        console.log(`Database "${dbName}" exists.`);
        await connection.query(`USE ${dbName}`);
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`Tables in "${dbName}":`, tables.map(t => Object.values(t)[0]));
      } else {
        console.log(`Database "${dbName}" does NOT exist.`);
      }
    }

    await connection.end();
  } catch (error) {
    console.error('Query Error:', error.message);
  }
}

main();
