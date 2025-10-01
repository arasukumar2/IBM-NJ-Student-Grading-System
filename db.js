import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";

const db = new sqlite3.Database("./grading.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin','faculty','student'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    roll TEXT UNIQUE,
    email TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT,
    credits INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    course_id INTEGER,
    marks REAL,
    grade TEXT,
    UNIQUE(student_id, course_id)
  )`);

  // Default users
  const defaults = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "faculty", password: "fac123", role: "faculty" },
    { username: "student", password: "stu123", role: "student" }
  ];

  defaults.forEach(u => {
    bcrypt.hash(u.password, 10, (err, hash) => {
      db.run(
        "INSERT OR IGNORE INTO users (username,password,role) VALUES (?,?,?)",
        [u.username, hash, u.role]
      );
    });
  });
});

export default db;
