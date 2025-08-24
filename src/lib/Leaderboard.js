import Storage from './Storage.js';

const LOCAL_KEY = 'flappy_local_leaderboard_v1';

export default class Leaderboard {
  // format: [{name, score, date}]
  static getLocal(limit = 10) {
    const arr = Storage.get(LOCAL_KEY, []);
    return arr.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  static addLocal(name, score) {
    const arr = Storage.get(LOCAL_KEY, []);
    arr.push({ name: name || 'Player', score: Math.floor(score), date: new Date().toISOString() });
    Storage.set(LOCAL_KEY, arr);
    return this.getLocal();
  }

  // Optional remote API. By default it's a stub that resolves immediately.
  static async submitRemote(url, payload) {
    if (!url) {
      console.warn('Remote leaderboard URL not set. Skipping remote submit.');
      return null;
    }
    try {
      const res = await fetch(url + '/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('submitRemote error', e);
      return null;
    }
  }

  static async fetchRemote(url, limit = 20) {
    if (!url) return [];
    try {
      const res = await fetch(`${url}/scores?limit=${limit}`);
      return await res.json();
    } catch (e) {
      console.error('fetchRemote error', e);
      return [];
    }
  }
}