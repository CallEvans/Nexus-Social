// Nexus Social — API Helper
const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || 'Request failed');
    return json;
  },
  async delete(url) {
    const r = await fetch(url, { method: 'DELETE' });
    return r.json();
  }
};
