// ═══ TIETOKANTA (SQLite + Persistent Disk) ═══
const Database = require("better-sqlite3");
const path = require("path");

// Renderissä Persistent Disk mount path, lokaalisti ./data
const DB_DIR = process.env.DB_PATH || path.join(__dirname, "data");
const fs = require("fs");
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, "pm_agent.db"));

// WAL-moodi parantaa suorituskykyä
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ═══ SKEEMA ═══
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    context_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS presentations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    focus_type TEXT DEFAULT '',
    state_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ═══ MIGRAATIO: Vanha projects-taulu → uusi rakenne ═══
// Tarkista onko vanha rakenne (state_json + focus_type projects-taulussa)
try {
  const cols = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (cols.includes("state_json") && cols.includes("focus_type")) {
    console.log("🔄 Migrating old projects to new structure...");
    // Lisää context_json jos puuttuu
    if (!cols.includes("context_json")) {
      db.exec("ALTER TABLE projects ADD COLUMN context_json TEXT DEFAULT '{}'");
    }
    // Siirrä vanhat projektit: jokainen vanha projekti → yksi esitys
    const oldProjects = db.prepare("SELECT * FROM projects WHERE state_json IS NOT NULL AND state_json != '{}'").all();
    for (const p of oldProjects) {
      try {
        // Tarkista ettei esitystä ole jo luotu tälle projektille
        const existing = db.prepare("SELECT id FROM presentations WHERE project_id = ?").get(p.id);
        if (!existing) {
          const state = JSON.parse(p.state_json || "{}");
          // Tallenna jaettu konteksti projektille
          const ctx = { summary: state.summary || "", docContext: state.docContext || "", decisions: state.decisions || [] };
          db.prepare("UPDATE projects SET context_json = ? WHERE id = ?").run(JSON.stringify(ctx), p.id);
          // Luo esitys vanhasta datasta
          db.prepare("INSERT INTO presentations (project_id, user_id, name, focus_type, state_json) VALUES (?, ?, ?, ?, ?)").run(
            p.id, p.user_id, p.name, p.focus_type || "", p.state_json
          );
        }
      } catch (e) { console.warn("Migration skipped for project", p.id, e.message); }
    }
    // Poista vanhat sarakkeet luomalla uusi taulu (SQLite ei tue DROP COLUMN vanhemmissa versioissa)
    // Jätetään vanhat sarakkeet paikalleen — ei haittaa, presentations-taulu on uusi lähde
    console.log("✅ Migration complete");
  }
} catch (e) { console.warn("Migration check:", e.message); }

// ═══ PREPARED STATEMENTS ═══

// -- Users --
const createUser = db.prepare(
  "INSERT INTO users (username, password_hash) VALUES (?, ?)"
);
const getUserByUsername = db.prepare(
  "SELECT * FROM users WHERE username = ?"
);
const getUserById = db.prepare(
  "SELECT id, username, is_admin, created_at, last_login FROM users WHERE id = ?"
);
const updateLastLogin = db.prepare(
  "UPDATE users SET last_login = datetime('now') WHERE id = ?"
);

// -- Admin --
const getAllUsers = db.prepare(
  "SELECT id, username, is_admin, created_at, last_login FROM users ORDER BY created_at DESC"
);
const deleteUser = db.prepare(
  "DELETE FROM users WHERE id = ?"
);
const resetPassword = db.prepare(
  "UPDATE users SET password_hash = ? WHERE id = ?"
);

// -- Projects (nyt kevyempi: nimi + jaettu konteksti) --
const createProject = db.prepare(
  "INSERT INTO projects (user_id, name, description, context_json) VALUES (?, ?, ?, ?)"
);
const getProjectsByUser = db.prepare(
  "SELECT id, name, description, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
);
const getProjectById = db.prepare(
  "SELECT * FROM projects WHERE id = ? AND user_id = ?"
);
const updateProject = db.prepare(
  "UPDATE projects SET name = ?, description = ?, context_json = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
);
const deleteProject = db.prepare(
  "DELETE FROM projects WHERE id = ? AND user_id = ?"
);

// -- Presentations (esitykset projektin alla) --
const createPresentation = db.prepare(
  "INSERT INTO presentations (project_id, user_id, name, focus_type, state_json) VALUES (?, ?, ?, ?, ?)"
);
const getPresentationsByProject = db.prepare(
  "SELECT id, project_id, name, focus_type, created_at, updated_at FROM presentations WHERE project_id = ? AND user_id = ? ORDER BY updated_at DESC"
);
const getPresentationById = db.prepare(
  "SELECT * FROM presentations WHERE id = ? AND user_id = ?"
);
const updatePresentation = db.prepare(
  "UPDATE presentations SET name = ?, focus_type = ?, state_json = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
);
const deletePresentation = db.prepare(
  "DELETE FROM presentations WHERE id = ? AND user_id = ?"
);

// -- Agent Profiles --
const createProfile = db.prepare(
  "INSERT INTO agent_profiles (user_id, name, instructions) VALUES (?, ?, ?)"
);
const getProfilesByUser = db.prepare(
  "SELECT * FROM agent_profiles WHERE user_id = ? ORDER BY name"
);
const getProfileById = db.prepare(
  "SELECT * FROM agent_profiles WHERE id = ? AND user_id = ?"
);
const updateProfile = db.prepare(
  "UPDATE agent_profiles SET name = ?, instructions = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
);
const deleteProfile = db.prepare(
  "DELETE FROM agent_profiles WHERE id = ? AND user_id = ?"
);

module.exports = {
  db,
  users: { create: createUser, getByUsername: getUserByUsername, getById: getUserById, updateLastLogin, getAll: getAllUsers, delete: deleteUser, resetPassword },
  projects: { create: createProject, getByUser: getProjectsByUser, getById: getProjectById, update: updateProject, delete: deleteProject },
  presentations: { create: createPresentation, getByProject: getPresentationsByProject, getById: getPresentationById, update: updatePresentation, delete: deletePresentation },
  profiles: { create: createProfile, getByUser: getProfilesByUser, getById: getProfileById, update: updateProfile, delete: deleteProfile },
};
