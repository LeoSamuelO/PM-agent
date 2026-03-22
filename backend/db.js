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

// ═══ MIGRAATIO: poista vanha skeema jos sarakkeet eivät täsmää ═══
try {
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (cols.length > 0 && !cols.includes("username")) {
    // Vanha skeema (email-pohjainen) — pudota ja luo uudelleen
    db.exec("DROP TABLE IF EXISTS agent_profiles; DROP TABLE IF EXISTS projects; DROP TABLE IF EXISTS users;");
    console.log("🔄 Vanha tietokanta nollattu (skeema muuttunut)");
  }
} catch (e) { /* taulu ei vielä ole olemassa — OK */ }

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
  users: { create: createUser, getByUsername: getUserByUsername, getById: getUserById, updateLastLogin, getAll: getAllUsers, delete: deleteUser, resetPassword },
  projects: { create: createProject, getByUser: getProjectsByUser, getById: getProjectById, update: updateProject, delete: deleteProject },
  profiles: { create: createProfile, getByUser: getProfilesByUser, getById: getProfileById, update: updateProfile, delete: deleteProfile },
};
