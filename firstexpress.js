// REMEMBER TO MAKE SURE ALL PACKAGES - denoted by require('package_name') are installed when porting over to a remote instance
const express = require('express')
const app = express()
const port = 80

const nodemailer = require('nodemailer');
var NodeSession = require('node-session');

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

// Create DB and it's associated collections
MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  // Create database
  var dbo = db.db("db");
  console.log("Database created!");

  // Create collections for Users, then Verified Users
  dbo.createCollection("users", function(err, res) {
    if (err) throw err;
    console.log("Users Collection created!");
    db.close();
  });

  dbo.createCollection("verified_users", function(err, res) {
    if (err) throw err;
    console.log("Verified Users Collection created!");
    db.close();
  });
});

// Setup email createServer
// First, create GLOBAL transporter var
var transporter = {};

// Generate test SMTP service account from ethereal.email
nodemailer.createTestAccount((err, account) => {

    // Explained as 3 steps process as I explaned in tutorial

    //Step: 1 Create transporter
    let smtpConfig = {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports. For TLS use port 465
        auth: {
            user: account.user, // generated ethereal user
            pass: account.pass // generated ethereal password
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

app.post('/test', (req, res) => function(req, res) {
  console.log("Test endpoint routing");
  res.send("Test return value");
})

app.get('/adduser', (req, res) => res.send('GET for /adduser'))

app.post('/adduser', (req, res) => function(req, res) {
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
    console.log("Connecting to DB ...");
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("mydb");
      var myobj = { username: username, password: password };
      dbo.collection("users").insertOne(myobj, function(err, res) {
        if (err) throw err;
        console.log("1 document inserted into USERS collection");
        db.close();
      });
    });

    // Send key to the given email
    console.log("Sending key");
    var key = "abracadbra";
    var email = req.body.email;

    //Step: 2 Setup message options
    var mailOptions = {
      from: 'someguy@cato.com',
      to: 'myfriend@yahoo.com',
      subject: 'Registration',
      text: 'Key is ' + key
    };

    //Step: 3 Send mail using created transport
    global.transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

    res.json({"status": "OK"});
  }
})

app.post('/login', (req, res) => function(req, res) {
  if (req.body.username == null) {
    res.json({"status": "error", "error": "no username found"});
  }
  else if (req.body.password == null) {
    res.json({"status": "error", "error": "no password found"});
  }
  else {
    var username = req.body.username;
    var password = req.body.password;

    // Determine that this user is verified


    // If verified, put them in the session
    req.session.put('Username', username);
  }
})

app.post('/logout', (req, res) => function(req, res) {
  req.session.flush();

  res.json({"status": "OK"});
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
