const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.bnofeyrcvvlaweoryisw:TF%40Viagens2025%24@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    console.log("Connecting using Pooler SA-EAST-1...");
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    console.log("Tables in public schema:");
    res.rows.forEach(r => console.log("- " + r.table_name));

    console.log("Reloading schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Done.");
  } catch (err) {
    console.error("Pooler failed. Trying direct IPv6/IPv4...", err.message);
    try {
      const client2 = new Client({
        connectionString: 'postgresql://postgres:TF%40Viagens2025%24@db.bnofeyrcvvlaweoryisw.supabase.co:5432/postgres'
      });
      await client2.connect();
      const res = await client2.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
      console.log("Tables in public schema:");
      res.rows.forEach(r => console.log("- " + r.table_name));
  
      console.log("Reloading schema cache...");
      await client2.query("NOTIFY pgrst, 'reload schema';");
      console.log("Done.");
      await client2.end();
    } catch (e2) {
      console.error("Direct connection failed too:", e2.message);
    }
  } finally {
    await client.end();
  }
}
run();
