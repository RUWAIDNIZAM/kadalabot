const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresStorage } = require('../storage');

const createMockPool = (responses = []) => {
    const calls = [];

    return {
        calls,
        async query(text, params) {
            calls.push({ text: String(text), params });
            const response = responses.shift();

            if (response instanceof Error) throw response;
            return response || { rows: [] };
        }
    };
};

test('initialize creates required tables and seed row', async () => {
    const pool = createMockPool([{}, {}, {}, {}, {}]);
    const storage = new PostgresStorage(pool);

    await storage.initialize();

    assert.equal(pool.calls.length, 5);
    assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS user_stats/);
    assert.match(pool.calls[1].text, /CREATE TABLE IF NOT EXISTS count_lb/);
    assert.match(pool.calls[2].text, /CREATE TABLE IF NOT EXISTS game_state/);
    assert.match(pool.calls[3].text, /CREATE TABLE IF NOT EXISTS afk_users/);
    assert.match(pool.calls[4].text, /INSERT INTO game_state/);
});

test('loadState maps rows to in-memory objects', async () => {
    const now = 777777;
    const pool = createMockPool([
        { rows: [{ user_id: 'u1', username: 'Alice', message_count: '12' }] },
        { rows: [{ user_id: 'u1', username: 'Alice', points: '5' }] },
        { rows: [{ current: '9', highscore: '21', last_user: 'u1' }] },
        {
            rows: [
                { user_id: 'u1', reason: 'Lunch', afk_since: '1700000000000' },
                { user_id: 'u2', reason: 'Break', afk_since: null }
            ]
        }
    ]);

    const storage = new PostgresStorage(pool, () => now);
    const state = await storage.loadState();

    assert.deepEqual(state.userStats, {
        u1: { username: 'Alice', count: 12 }
    });

    assert.deepEqual(state.countLB, {
        u1: { username: 'Alice', points: 5 }
    });

    assert.deepEqual(state.gameData, {
        current: 9,
        highscore: 21,
        lastUser: 'u1'
    });

    assert.deepEqual(state.afkUsers, {
        u1: { reason: 'Lunch', time: 1700000000000 },
        u2: { reason: 'Break', time: now }
    });
});

test('upsert and update methods send correct SQL params', async () => {
    const pool = createMockPool([{}, {}, {}, {}, {}]);
    const storage = new PostgresStorage(pool);

    await storage.upsertUserStat('u1', { username: 'Alice', count: 10 });
    await storage.upsertCountStat('u1', { username: 'Alice', points: 4 });
    await storage.saveGameData({ current: 5, highscore: 11, lastUser: 'u1' });
    await storage.setAfkUser('u1', { reason: 'Sleep', time: 1700000011111 });
    await storage.deleteAfkUser('u1');

    assert.deepEqual(pool.calls[0].params, ['u1', 'Alice', 10]);
    assert.deepEqual(pool.calls[1].params, ['u1', 'Alice', 4]);
    assert.deepEqual(pool.calls[2].params, [5, 11, 'u1']);
    assert.deepEqual(pool.calls[3].params, ['u1', 'Sleep', 1700000011111]);
    assert.deepEqual(pool.calls[4].params, ['u1']);
});

test('loadState returns defaults when game row does not exist', async () => {
    const pool = createMockPool([
        { rows: [] },
        { rows: [] },
        { rows: [] },
        { rows: [] }
    ]);
    const storage = new PostgresStorage(pool);

    const state = await storage.loadState();

    assert.deepEqual(state.userStats, {});
    assert.deepEqual(state.countLB, {});
    assert.deepEqual(state.afkUsers, {});
    assert.deepEqual(state.gameData, { current: 0, highscore: 0, lastUser: null });
});