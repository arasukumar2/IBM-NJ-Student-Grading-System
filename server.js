import express from "express";
import session from "express-session";
import flash from "connect-flash";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import db from "./db.js";

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: "grading-secret",
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.messages = req.flash();
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// --- Routes ---
app.get("/", (req, res) => res.render("index"));

app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      return res.redirect("/dashboard");
    }
    req.flash("error", "Invalid credentials");
    res.redirect("/login");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/dashboard", requireLogin, (req, res) => {
  db.get("SELECT COUNT(*) as c FROM students", (e,s)=> {
    db.get("SELECT COUNT(*) as c FROM courses", (e2,c)=> {
      db.get("SELECT COUNT(*) as c FROM grades", (e3,g)=> {
        res.render("dashboard", {
          studentCount: s.c, courseCount: c.c, gradeCount: g.c
        });
      });
    });
  });
});

// --- Students ---
app.get("/students", requireLogin, (req,res)=>{
  db.all("SELECT * FROM students", (err, rows)=> {
    res.render("students",{students:rows});
  });
});
app.post("/students", requireLogin, (req,res)=>{
  const {name, roll, email} = req.body;
  db.run("INSERT INTO students (name,roll,email) VALUES (?,?,?)",
         [name,roll,email], (err)=>{
    if (err) req.flash("error", "Duplicate roll/email");
    res.redirect("/students");
  });
});

// --- Courses ---
app.get("/courses", requireLogin, (req,res)=>{
  db.all("SELECT * FROM courses", (err, rows)=> {
    res.render("courses",{courses:rows});
  });
});
app.post("/courses", requireLogin, (req,res)=>{
  const {code, name, credits} = req.body;
  db.run("INSERT INTO courses (code,name,credits) VALUES (?,?,?)",
         [code,name,credits], (err)=>{
    if (err) req.flash("error","Duplicate code");
    res.redirect("/courses");
  });
});

// --- Grades ---
function calcGrade(marks){
  if (marks>=90) return "A+";
  if (marks>=80) return "A";
  if (marks>=70) return "B+";
  if (marks>=60) return "B";
  if (marks>=50) return "C";
  return "F";
}

app.get("/grades", requireLogin, (req,res)=>{
  db.all("SELECT * FROM students", (e, students)=>{
    db.all("SELECT * FROM courses", (e2, courses)=>{
      db.all(`SELECT g.id, s.name student, c.name course, g.marks, g.grade
              FROM grades g JOIN students s ON g.student_id=s.id
              JOIN courses c ON g.course_id=c.id`, (e3,grades)=>{
        res.render("grades",{students,courses,grades});
      });
    });
  });
});

app.post("/grades", requireLogin, (req,res)=>{
  const {student_id, course_id, marks} = req.body;
  const grade = calcGrade(parseFloat(marks));
  db.run(`INSERT INTO grades (student_id,course_id,marks,grade)
          VALUES (?,?,?,?)
          ON CONFLICT(student_id,course_id) DO UPDATE SET marks=excluded.marks, grade=excluded.grade`,
          [student_id, course_id, marks, grade], ()=> res.redirect("/grades"));
});

// --- Report ---
app.get("/report/:id", requireLogin, (req,res)=>{
  const sid = req.params.id;
  db.get("SELECT * FROM students WHERE id=?", [sid], (err,student)=>{
    db.all(`SELECT c.code,c.name,c.credits,g.marks,g.grade
            FROM courses c LEFT JOIN grades g
            ON g.course_id=c.id AND g.student_id=?`, [sid], (err2,rows)=>{
      // GPA
      let totalPts=0, totalCred=0;
      const ptsMap = {"A+":10,"A":9,"B+":8,"B":7,"C":6,"F":0};
      rows.forEach(r=>{
        if(r.grade){ totalPts += ptsMap[r.grade]*r.credits; totalCred+=r.credits;}
      });
      const gpa = totalCred ? (totalPts/totalCred).toFixed(2):0;
      res.render("report",{student, rows, gpa});
    });
  });
});

app.listen(3000, ()=> console.log("Server running at http://localhost:3000"));
