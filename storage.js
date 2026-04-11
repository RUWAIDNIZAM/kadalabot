class PostgresStorage {
    constructor(pool, nowFn = () => Date.now()) {
        this.pool = pool;
        this.nowFn = nowFn;
    }

    async initialize() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                message_count INTEGER NOT NULL DEFAULT 0
            );
        `);

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS count_lb (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                points INTEGER NOT NULL DEFAULT 0
            );
        `);

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS game_state (
                id SMALLINT PRIMARY KEY CHECK (id = 1),
                current INTEGER NOT NULL DEFAULT 0,
                highscore INTEGER NOT NULL DEFAULT 0,
                last_user TEXT
            );
        `);

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS afk_users (
                user_id TEXT PRIMARY KEY,
                reason TEXT NOT NULL,
                afk_since BIGINT NOT NULL
            );
        `);

        await this.pool.query(`
            INSERT INTO game_state (id, current, highscore, last_user)
            VALUES (1, 0, 0, NULL)
            ON CONFLICT (id) DO NOTHING;
        `);
    }

    async loadState() {
        const statsRes = await this.pool.query('SELECT user_id, username, message_count FROM user_stats');
        const userStats = Object.fromEntries(
            statsRes.rows.map((row) => [
                row.user_id,
                { username: row.username, count: Number(row.message_count) || 0 }
            ])
        );

        const countRes = await this.pool.query('SELECT user_id, username, points FROM count_lb');
        const countLB = Object.fromEntries(
            countRes.rows.map((row) => [
                row.user_id,
                { username: row.username, points: Number(row.points) || 0 }
            ])
        );

        const gameRes = await this.pool.query('SELECT current, highscore, last_user FROM game_state WHERE id = 1');
        const gameRow = gameRes.rows[0];
        const gameData = gameRow
            ? {
                current: Number(gameRow.current) || 0,
                highscore: Number(gameRow.highscore) || 0,
                lastUser: gameRow.last_user || null
            }
            : { current: 0, highscore: 0, lastUser: null };

        const afkRes = await this.pool.query('SELECT user_id, reason, afk_since FROM afk_users');
        const afkUsers = Object.fromEntries(
            afkRes.rows.map((row) => [
                row.user_id,
                {
                    reason: row.reason,
                    time: Number(row.afk_since) || this.nowFn()
                }
            ])
        );

        return { userStats, countLB, gameData, afkUsers };
    }

    async upsertUserStat(userId, stat) {
        if (!stat) return;

        await this.pool.query(
            `
                INSERT INTO user_stats (user_id, username, message_count)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id) DO UPDATE
                SET username = EXCLUDED.username,
                    message_count = EXCLUDED.message_count;
            `,
            [userId, stat.username, stat.count]
        );
    }

    async upsertCountStat(userId, stat) {
        if (!stat) return;

        await this.pool.query(
            `
                INSERT INTO count_lb (user_id, username, points)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id) DO UPDATE
                SET username = EXCLUDED.username,
                    points = EXCLUDED.points;
            `,
            [userId, stat.username, stat.points]
        );
    }

    async saveGameData(gameData) {
        await this.pool.query(
            `
                UPDATE game_state
                SET current = $1,
                    highscore = $2,
                    last_user = $3
                WHERE id = 1;
            `,
            [gameData.current, gameData.highscore, gameData.lastUser]
        );
    }

    async setAfkUser(userId, afk) {
        if (!afk) return;

        await this.pool.query(
            `
                INSERT INTO afk_users (user_id, reason, afk_since)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id) DO UPDATE
                SET reason = EXCLUDED.reason,
                    afk_since = EXCLUDED.afk_since;
            `,
            [userId, afk.reason, afk.time]
        );
    }

    async deleteAfkUser(userId) {
        await this.pool.query('DELETE FROM afk_users WHERE user_id = $1', [userId]);
    }
}

module.exports = { PostgresStorage };