export default class Storage {
    static get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        console.error('Storage get error', e);
        return fallback;
      }
    }
  
    static set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('Storage set error', e);
      }
    }
  
    static remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Storage remove error', e);
      }
    }
  }