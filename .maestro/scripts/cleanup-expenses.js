// Deletes the demo account's expenses whose amount is in AMOUNTS, through the API.
//
// Shared by the onFlowComplete hooks of edit-delete.yaml and quick-add.yaml (TEN-462). Callers
// pass AMOUNTS as a comma-separated list, e.g. "177,226.53". Matching is on amount alone because
// the AI parse rewrites the description.
//
// Logs in itself: a failure at launch means `output.token` was never set. A failed login throws
// rather than returning, so a broken cleanup is a visible red flow and not a silent skip that
// leaves rows behind.
//
// Calls the legacy unversioned surface (decimal amounts), as launch.yaml does; it breaks if those
// paths are retired.

// Provided by Maestro's script runtime and the calling flow's env, not imported.
/* global http, json, AMOUNTS, GASTOSAI_EMAIL, GASTOSAI_PASSWORD */

const base = 'http://localhost:8080';
const jsonHeaders = { 'Content-Type': 'application/json' };

const wanted = AMOUNTS.split(',').map(Number);

const login = http.post(base + '/auth/login', {
  headers: jsonHeaders,
  body: JSON.stringify({ email: GASTOSAI_EMAIL, password: GASTOSAI_PASSWORD }),
});
const token = json(login.body).token;
if (!token) {
  throw new Error('cleanup login failed: no token');
}
const auth = { Authorization: 'Bearer ' + token };

const body = json(http.get(base + '/expenses', { headers: auth }).body);
const rows = body.content ? body.content : body;
for (let i = 0; i < rows.length; i++) {
  if (wanted.indexOf(Number(rows[i].amount)) !== -1) {
    http.delete(base + '/expenses/' + rows[i].id, { headers: auth });
  }
}
