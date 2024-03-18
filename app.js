const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "taskManager.db");
const app = express();
app.use(cors());
app.use(express.json());

let db;

//establish connection between database and server

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at 3000 port");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

initializeDbAndServer();

// Middleware function to authenticate token
const authenticateToken = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    // Token not provided
    res.status(401);
    res.send({ message: "Invalid JWT Token" });
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        // Incorrect token
        res.status(401);
        res.send({ message: "Invalid JWT Token" });
      } else {
        req.username = payload.username; // Pass data to the next handler with req obj

        next(); // Call the next handler or middleware
      }
    });
  }
};

//sample
app.get("/", (req, res) => {
  res.send("Hello World");
});

//creating a user

app.post("/register/", async (req, res) => {
  try {
    const { username, name, gender, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10); //masking the password for password protection

    const isUserExitsQuery = `select * from user where username='${username}'`;
    const checkIsUserExits = await db.get(isUserExitsQuery); //checking if user is already exits in the data base or not
    if (checkIsUserExits !== undefined) {
      //if user exits this block will excutes
      res.status(400);
      res.send({ errorMessage: "user is already exits" });
    } else {
      if (password.length < 6) {
        res.status(401);
        res.send({
          message: "password is too short please enter atleast 6 charecters",
        });
      } else {
        //if user is a new user
        const postQuery = `insert into user(username,name,gender,password)
    values("${username}","${name}","${gender}","${hashedPassword}")`;

        await db.run(postQuery);
        res.send({ message: "user created successfully" });
      }
    }
  } catch (error) {
    console.log(error.message);
  }
});

//User Login API
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery); // Check user in db
  if (dbUser === undefined) {
    // If user doesn't have account
    res.status(400);
    res.send({ message: "Invalid user" });
  } else {
    // If user has an A/C
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      // Correct pw
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      res.send({ jwtToken, username });
    } else {
      // Incorrect pw
      res.status(400);
      res.send({ message: "username and password didn't match" });
    }
  }
});

//Add a new taks

app.post("/addTask/", authenticateToken, async (req, res) => {
  try {
    const { task, isComplete = false } = req.body;
    const sqlQuery = `insert into tasks(username,task,isComplete)
    values ('${req.username}','${task}',${isComplete})`;
    await db.run(sqlQuery);
    res.send({ message: "Task add successfully" });
  } catch (error) {
    console.log(error.message);
  }
});

// get all tasks

app.get("/allTaks", authenticateToken, async (req, res) => {
  try {
    const sqlQuery = `select id,task,
    case
    when isComplete=1 then "true"
    else "false"
    end as isComplete
     from tasks where username ="${req.username}"`;
    const allTask = await db.all(sqlQuery);
    res.send({ allTask });
  } catch (error) {
    console.log(error.message);
  }
});

//update Task

app.put("/update/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { task } = req.body;
  const sqlQuery = `update tasks set task="${task}" where id =${id}`;

  const dbRes = await db.run(sqlQuery);
  res.send({ message: "Task updated successfully" });
});

//delete Task

app.delete("/delete/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const isIdCheck = `select * from tasks where id =${id}`;
  const isIdExist = await db.get(isIdCheck);
  if (isIdExist === undefined) {
    res.status(401);
    res.send({ message: "Task is already deleted" });
  } else {
    const sqlQery = `delete  from tasks where id=${id}`;
    await db.run(sqlQery);
    res.send({ message: "Task deleted successfully" });
  }
});

//update status of task

app.put("/updateStatus/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isComplete } = req.body;
    const sqlQuery = `update tasks set isComplete =${isComplete} where id=${id}`;
    const dbRes = await db.run(sqlQuery);
    res.send({ message: "Status Updated Successfully" });
  } catch (error) {
    console.log(error.message);
  }
});
