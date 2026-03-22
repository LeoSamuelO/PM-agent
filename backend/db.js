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
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    focus_type TEXT DEFAULT '',
    state_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
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

// ═══ PREPARED STATEMENTS ═══

// -- Users --
const createUser = db.prepare(
  "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)"
);
const getUserByEmail = db.prepare(
  "SELECT * FROM users WHERE email = ?"
);
const getUserById = db.prepare(
  "SELECT id, email, name, created_at, last_login FROM users WHERE id = ?"
);
const updateLastLogin = db.prepare(
  "UPDATE users SET last_login = datetime('now') WHERE id = ?"
);

// -- Projects --
const createProject = db.prepare(
  "INSERT INTO projects (user_id, name, description, focus_type, state_json) VALUES (?, ?, ?, ?, ?)"
);
const getProjectsByUser = db.prepare(
  "SELECT id, name, description, focus_type, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
);
const getProjectById = db.prepare(
  "SELECT * FROM projects WHERE id = ? AND user_id = ?"
);
const updateProject = db.prepare(
  "UPDATE projects SET name = ?, description = ?, focus_type = ?, state_json = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
);
const deleteProject = db.prepare(
  "DELETE FROM projects WHERE id = ? AND user_id = ?"
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
  users: { create: createUser, getByEmail: getUserByEmail, getById: getUserById, updateLastLogin },
  projects: { create: createProject, getByUser: getProjectsByUser, getById: getProjectById, update: updateProject, delete: deleteProject },
  profiles: { create: createProfile, getByUser: getProfilesByUser, getById: getProfileById, update: updateProfile, delete: deleteProfile },
};
