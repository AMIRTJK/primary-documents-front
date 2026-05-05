import { getDb, initDb } from './src/db/index.js';

async function checkStats() {
    await initDb();
    const db = getDb();

    console.log('\n=== СТАТИСТИКА ФИДБЕКА ИИ ===\n');

    const stats = await db.all('SELECT type, COUNT(*) as count FROM ai_feedback GROUP BY type');
    console.table(stats);

    console.log('\n=== ПОСЛЕДНИЕ КОММЕНТАРИИ ===\n');
    const comments = await db.all('SELECT comment, createdAt FROM ai_feedback WHERE comment IS NOT NULL ORDER BY createdAt DESC LIMIT 10');
    console.table(comments);

    process.exit(0);
}

checkStats();
