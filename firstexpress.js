// REMEMBER TO MAKE SURE ALL PACKAGES - denoted by require('package_name') are installed when porting over to a remote instance
const express = require('express')
const app = express()
const port = 3000;

const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
var NodeSession = require('node-session');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(express.json());

//var mongoose = require('mongoose');
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";
var mongodb;
var sodb;

// Create DB and it's associated collections

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  // Create database
  mongodb = db;
  sodb = mongodb.db("stackoverflowclone");
  console.log("Database created!");

  // Create collections for Users, then Verified Users
  sodb.createCollection("users", function(err, res) {
    if (err) throw err;
    console.log("Users Collection created!");
    //db.close();
  });

  sodb.createCollection("verified_users", function(err, res) {
    if (err) throw err;
    console.log("Verified Users Collection created!");
    //db.close();
  });

  sodb.createCollection("questions", function(err, res) {
    if (err) throw err;
    console.log("Questions collection created");
  })

  sodb.createCollection("answers", function(err, res) {
    if (err) throw err;
    console.log("Answers collection created");
  })
});

// Setup email createServer
// First, create GLOBAL transporter var
var transporter = {};

// Generate test SMTP service account from ethereal.email
nodemailer.createTestAccount((err, account) => {

    // Explained as 3 steps process as I explaned in tutorial

    //Step: 1 Create transporter
    let smtpConfig = {
        host: 'smtp.gmail.com',
        service: 'gmail',
        port: 587,
        secure: false, // true for 465, false for other ports. For TLS use port 465
        auth: {
            user: "friedcomputerz208@gmail.com", // generated ethereal user
            pass: "qasmltrjzjsmfxui" // generated ethereal password
        }
    };

    global.transporter = nodemailer.createTransport(smtpConfig);
    console.log("Created Test E-Mail Account");
});

// Adding session support
// init
session = new NodeSession({secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD'});

// start session for an http request - response
// this will define a session property to the request object
app.use(function (req, res, next) {
    session.startSession(req, res, function() {
        console.log("Start session function called");
        // ...
        next();
    });
})


app.get('/', (req, res) => res.send('Hello World!'))

app.post('/', (req, res) => res.send('App running'))

app.post('/test', (req, res) => {
  console.log("Test endpoint routing");
  res.send("Test return value");
})

app.get('/adduser', (req, res) => res.send('GET for /adduser'))

app.post('/adduser', (req, res) => {
  console.log("Add User POST Request");
  // Missing key cases
  if (req.body.username == null) {
    res.json({"status": "error", "error": "no username found"})
  }
  else if (req.body.password == null) {
    res.json({"status": "error", "error": "no password found"})
  }
  else if (req.body.email == null) {
    res.json({"status": "error", "error": "no email found"})
  }

  // Every key is in and has a value so ...
  else {
    console.log("All fields found");
    // Insert into USERS Database
    var username = req.body.username;
    var password = req.body.password;
    console.log(username + " " + password);
    console.log("Connecting to DB ...");

    // Send key to the given email
    console.log("Generating key");
    var key = "abracadabra";
    var email = req.body.email;
    console.log(email);

      var myobj = { username: username, email: email, password: password, key: key};
      sodb.collection("users").insertOne(myobj, function(err, res) {
        if (err) throw err;
        console.log("1 document inserted into USERS collection");
        //db.close();
      });

    //Step: 2 Setup message options
    var mailOptions = {
      from: 'friedcomputerz208@gmail.com',
      to: email,
      subject: 'Verification Key',
      text: 'validation key: <' + key + '>'
    };

    //Step: 3 Send mail using created transport
    console.log("Sending email");
    global.transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log("Error message below");
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

    res.json({"status": "OK"});
  }
})

app.post('/verify', (req, res) => {
  if (req.body.email == null) {
    res.json({"status": "error", "error": "no email found"});
  }
  else if (req.body.key == null) {
    res.json({"status": "error", "error": "no verification key found"});
  }
  // All forms filled
  else {
    var retdict = {"status":"OK"};
    var email = req.body.email;
    var key = req.body.key;

    var username = "", password = "";

    // Find the user in the database, then make sure email matches the Key
    console.log("Connecting to DB...");
    console.log(retdict);

    // Get user email and check it matches up with the key sent to that email
    sodb.collection("users").findOne({email: email}).then(function(result) {
      console.log(result);
      if (result == null) {
          console.log("Null result");

          retdict = {"status": "error", "error": "User not found with this key/email"};
          console.log(retdict);
          throw err;
      }
      else if (result.key != key) {
          console.log(result);
          console.log(result.key);
          console.log("Key does not match up");
          retdict = {"status": "error", "error": "Email and key do not match up."};
          throw err;
      }
      else { console.log(result.email);username = result.username; password = result.password;}
    }).then(function() {
      console.log("Connected to DB for insert");

      // Since we have verified the user, add them to the verified users colelction so that they can log in
          sodb.collection("verified_users").insertOne({username:username, password:password}).then(function(err, result) {
            console.log("1 verified user added to VERIFIED USERS collection");
            res.json(retdict);
          }).catch(function(err) {
            console.log("Email not found error");
            retdict = {"status": "error", "error": "Email not found"};
            res.json(retdict);
          })
            }).catch(function(err) {
              console.log("error");
              retdict = {"status": "error", "error": "Error"};
              res.json(retdict);
            })

        }
        // User from users database now verified and added to verified_users Database
        console.log("InsertOne DB Connection closed");
})


app.post('/login', (req, res) => {
  if (req.body.username == null) {
    res.json({"status": "error", "error": "no username found"});
  }
  else if (req.body.password == null) {
    res.json({"status": "error", "error": "no password found"});
  }
  else {
    var username = req.body.username;
    var password = req.body.password;
    var retdict = {"status":"OK"};

    // Determine that this user is verified
    sodb.collection("verified_users").findOne({"username": username}, function(err, result) {
      if (err) {
        retdict = {"status": "error", "error": "User is not verified"};
        res.json(retdict);
      }
      else if (result == null) {
        retdict = {"status":"error", "error": "User not verified or does not exist"};
        res.json(retdict);
      }
      else if (result.password !== password) {
        retdict = {"status": "error", "error": "Username and password do not match up."};
        res.json(retdict);
      }
      else {
        console.log(result.username);
        console.log("Entry found. Logging in.");

        // If verified, put them in the session
        req.session.put('username', username);
        console.log(req.session['__attributes']);

        res.json(retdict);
      }
    });
  }
})

app.post('/logout', (req, res) => {
  req.session['__attributes']['username'] = null;
  req.session.user = null; // maybe use req.session.forget() instead?
  user = null;

  res.json({"status": "OK"});
})

app.post('/questions/add', (req, res) => {
  //console.log("Session details:");
  console.log(req.session);
  // First, check that a user is logged in
  if (req.session['__attributes']['username'] == null) {
    res.json({"status": "error", "error": "No user logged in"});
  }
  else if (req.body.title == null) {
    res.json({"status": "error", "error": "No title for the question"});
  }
  else if (req.body.body == null) {
    res.json({"status": "error", "error": "The question needs a body"});
  }
  else if (req.body.tags == null) {
    res.json({"status": "error", "error": "The question needs at least one tag"});
  }
  else {
    var id = randomstring.generate();
    // Make sure that there does NOT exist an entry in the Questions collection that matches, god forbid
    /*sodb.collection("questions").findOne({"id":id}).then(function(result) {
      if (result != null) {

      }
    })*/
    var obj = {"id": id, "user": {"username": req.session['__attributes']['username'], "reputation": 0}, "title": req.body.title, "body": req.body.body, "score": 0, "view_count": 1, "answer_count": 0, "timestamp": Date.now(), "media": null, "tags": req.body.tags, "accepted_answer_id": null};
    sodb.collection("questions").insertOne(obj , function(err, result) {
      if (err) {
        res.json({"status": "error", "error": "Error creating question at this time"});
      }
      else {
        console.log("Question successfully inserted into Questions collection");
        sodb.collection("answers").insertOne({"id": id, "answers": []}, function(err2, result) {
          if (err2) throw err2;
          else console.log("Counterpart for this question in the answers collection also created.");
        })
        res.json({"status":"OK", "id": id});
      }
    })
  }
})

app.get('/questions/:id', (req, res) => {
  var id = req.params.id;

  sodb.collection("questions").findOne({"id": id}, function(err, result) {
    if (err) {
      console.log("Error");
      res.json({"status": "error", "error": "Error"});
    }
    else if (result == null) {
      console.log("Question not found");
      res.json({"status": "error", "error": "Question not found"});
    }
    else {
      console.log("Question found");

      // Update view Count
      var new_view_count = result.view_count + 1;
      var new_view_count_dict = {$set: {view_count: new_view_count}};

      sodb.collection("questions").updateOne({"id": id}, new_view_count_dict, function(err2, res2) {
        if (err2) throw err2;
        else {
          console.log("Question DB updated successfully");
          res.json({"status": "OK", "question": result});
        }
      })

      //res.json({"status": "OK", "question": result});
    }
  })

})

app.post('/questions/:id/answers/add', (req, res) => {
  var id = req.params.id;

  // First, check that a user is logged in
  if (req.session['__attributes']['username'] == null) {
    res.json({"status": "error", "error": "No user logged in"});
  }
  else if (req.body.body == null) {
    res.json({"status": "error", "error": "The answer needs a body"});
  }
  else {
    sodb.collection("answers").findOne({"id": id}, function(err, result) {
      if (err) {
        console.log("Error");
        res.json({"status": "error", "error": "Error"});
      }
      else if (result == null) {
        console.log("Nonexistent question");
        res.json({"status": "error", "error": "A question with this ID does not exist."});
      }
      else {
        console.log(result);
        console.log(result.answers);

        var answerid = randomstring.generate();
        var answerobj = {"id": answerid, "user": req.session['__attributes']['username'], "body": req.body.body, "score": 0, "is_accepted": false, "timestamp": Date.now(), "media": null};

        var answers_arr = result.answers;
        answers_arr.push(answerobj);
        var new_answer_arr = {$set: {answers: answers_arr}};

        // Update DB Entry
        sodb.collection("answers").updateOne({"id": id}, new_answer_arr, function(err2, res2) {
          if (err2) throw err2;
          else {
            console.log("DB updated successfully");
          }
        })

        res.json({"status": "OK", "id": answerid});
      }
    })
  }

})

app.get('/questions/:id/answers', (req, res) => {
  var id = req.params.id;

  sodb.collection("answers").findOne({"id": id}, function(err, result) {
    if (err) {
      console.log("Error");
      res.json({"status": "error", "error": "Error"});
    }
    else if (result == null) {
      console.log("Nothing found");
      res.json({"status": "error", "error": "No such question exists with this ID"});
    }
    else {
      console.log(result.answers);

      res.json({"status": "OK", "answers": result.answers});
    }
  })
})

app.post('/questions/search', (req, res) => {
  var timestamp = Date.now();
  var limit = 25;
  var accepted = false;

  if (req != null && req.body != null) {
    if (req.body.timestamp != null) {
      timestamp = req.body.timestamp;
    }

    if (req.body.limit != null && req.body.limit >= 0 && req.body.limit <= 100) {
      limit = req.body.limit
    }

    if (req.body.accepted != null) {
      accepted = req.body.accepted;
    }
  }


})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
