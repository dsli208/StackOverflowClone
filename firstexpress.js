// REMEMBER TO MAKE SURE ALL PACKAGES - denoted by require('package_name') are installed when porting over to a remote instance
const express = require('express')
var cookieParser = require('cookie-parser')
const app = express()
const port = 3000;
app.use(cookieParser())
var path = require('path');

//var jwt = require('express-jwt');
const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
var NodeSession = require('node-session');
var session = require('express-session');
const bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '100mb', extended: true}))
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}))
app.use(express.json());

const ip = require('ip');
const request_ip = require('request-ip');
app.use(request_ip.mw())

const MongoStore = require('connect-mongo')(session);
const cookie = require('cookie');
const jwt = require('jsonwebtoken');

var morgan = require('morgan');

// New stuff for Media functionality (M3)
var fs = require('fs');
var Grid = require('gridfs');
var GridStore = require('mongodb').GridStore;

var cassandra = require('cassandra-driver');
var multer  = require('multer');
var upload = multer({dest: 'uploads/'});
var fs = require('file-system');

var Db = require('mongodb').Db,
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    ReplSetServers = require('mongodb').ReplSetServers,
    ObjectID = require('mongodb').ObjectID,
    Binary = require('mongodb').Binary,
    GridStore = require('mongodb').GridStore,
    Code = require('mongodb').Code,
    assert = require('assert'),
    GridFSBucket = require('mongodb').GridFSBucket;
var url = "mongodb://192.168.122.18:27017/";
//var url = "mongodb://localhost:27017/";
var mongodb;
var sodb;
var grid;
//var gridfs_bucket;

var glob_username;
var glob_session;

var lodash = require('lodash');

// Create DB and it's associated collections
MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  // Create database
  mongodb = db;
  sodb = mongodb.db("stackoverflowclone");
  console.log("Database created!");

  // Set up GridFS for large media/file storage
  grid = new Grid(db, 'fs');
  //gridfs_bucket = new require('mongodb').GridFSBucket(db);

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

  sodb.createCollection("views", function(err, res) {
    if (err) throw err;
    console.log("Views collection created");
  })

  sodb.createCollection("userbackup", function(err, res) {
    if (err) throw err;
    console.log("Backup user collection created");
  })

  sodb.createCollection("answer_list", function(err, res) {
    if (err) throw err;
    console.log("Created answer list");
  })

  sodb.createCollection("media", function(err, res) {
    if (err) throw err;
    console.log("Created media use records");
  })

  sodb.collection("questions").createIndex({"title": "text", "body": "text"}, function(err, res) {
    if (err) throw err;
    console.log("Created questions index for use during searching.");
  })
});

const cassandra_client = new cassandra.Client({
  contactPoints: ['192.168.122.19'],
  localDataCenter: 'datacenter1',
  keyspace: 'so_clone'
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
      auth: {
          user: 'lennie.lebsack46@ethereal.email',
          pass: '6gsxcCYSwzY9jP5AeU'
      }
    };

    global.transporter = nodemailer.createTransport(smtpConfig);
    console.log("Created Test E-Mail Account");
});

cassandra_client.connect(function (err) {
  console.log("Connected to Cassandra DB");
  console.log(Object.keys(cassandra_client.metadata.keyspaces));
});

var accessLogStream = fs.createWriteStream('/home/ubuntu/.pm2/logs/'+ '/access.log',{flags: 'a'});
// setup the logger
app.use(morgan('combined', {stream: accessLogStream}));

// Milestone 1

app.get('/', (req, res) => res.sendfile(path.join(__dirname + '/stackoverflowclone.html')))

app.post('/', (req, res) => res.send('App running'))

app.post('/test', (req, res) => {
  console.log("Test endpoint routing");
  res.send("Test return value");
})

app.get('/adduser', (req, res) => res.sendfile(path.join(__dirname + '/stackoverflowcloneadduser.html')))

app.post('/adduser', (req, res) => {
  const add_user_func = async function(req, res) {
    try {
      //console.log("Add User POST Request");
      // Missing key cases
      if (req.body.username == null) {
        res.send(403, {"status": "error", "error": "no username found"});
      }
      else if (req.body.password == null) {
        res.send(403, {"status": "error", "error": "no password found"});
      }
      else if (req.body.email == null) {
        res.send(403, {"status": "error", "error": "no email found"});
      }

      // Every key is in and has a value so ...
      else {
        //console.log("All fields found");
        // Insert into USERS Database
        var username = req.body.username;
        var password = req.body.password;
        //console.log(username + " " + password);
        //console.log("Connecting to DB ...");

        var users_collection = sodb.collection("users");
        var r1 = await users_collection.findOne({"username": username});
        //console.log(r1);

        // Username exists if we stop here ...
        if (r1 != null) {
          //console.log("User with the username " + username + " already exists");
          res.send(403, {"status": "error", "error": "User with the username " + username + " already exists"});
          return;
        }

        // If not ... no user exists so go ahead and add the user

        // Send key to the given email
        //console.log("Generating key");
        var key = "abracadabra";
        var email = req.body.email;
        //console.log(email);

        var myobj = { username: username, email: email, password: password, key: key};

        var r2 = users_collection.insertOne(myobj);

        /*sodb.collection("users").insertOne(myobj, function(err, res) {
          if (err) throw err;
          //console.log("1 document inserted into USERS collection");
          //db.close();
        });*/

        //Step: 2 Setup message options
        var mailOptions = {
          from: 'lennie.lebsack46@ethereal.email',
          to: email,
          subject: 'Verification Key',
          text: 'validation key: <' + key + '>'
        };

        //Step: 3 Send mail using created transport
        //console.log("Sending email");

        // Temporary patch fix
        let transporter = nodemailer.createTransport({
          host: 'localhost',
          port: 25,
          tls: {rejectUnauthorized: false}
        })

        transporter.sendMail(mailOptions, function(error, info){
          if (error) {
            //console.log("Error message below");
            //console.log(error);
          } else {
            //console.log('Email sent: ' + info.response);
          }
        });

        console.log("Successfuly added user with username " + username);
        res.json({"status": "OK"});
      }
    }
    catch (e) {
      //console.log("Add user error: " + e);
      res.send(403, {"status": "error", "error": e});
    }
  }
  add_user_func(req, res);
})

app.get('/verify', (req, res) => {
  res.sendfile(path.join(__dirname + '/stackoverflowcloneverify.html'))
})

app.post('/verify', (req, res) => {
  if (req.body.email == null) {
    console.log("No email found");
    res.send(403, {"status": "error", "error": "no email found"});
  }
  else if (req.body.key == null) {
    console.log("No verification key found");
    res.send(403, {"status": "error", "error": "no verification key found"});
  }
  // All forms filled
  else {
    var retdict = {"status":"OK"};
    var email = req.body.email;
    var key = req.body.key;

    var username = "", password = "";

    // Find the user in the database, then make sure email matches the Key
    //console.log("Connecting to DB...");
    //console.log(retdict);

    // Get user email and check it matches up with the key sent to that email
    sodb.collection("users").findOne({email: email}).then(function(result) {
      //console.log(result);
      if (result == null) {
          console.log("Null result");

          retdict = {"status": "error", "error": "User not found with this key/email"};
          //console.log(retdict);
          throw err;
      }
      else if (result.key != key) {
          //console.log(result);
          //console.log(result.key);
          //console.log("Key does not match up");
          retdict = {"status": "error", "error": "Email and key do not match up."};
          throw err;
      }
      else { console.log(result.email);username = result.username; password = result.password;}
    }).then(function() {
      //console.log("Connected to DB for insert");

      // Since we have verified the user, add them to the verified users colelction so that they can log in
          sodb.collection("verified_users").insertOne({username:username, password:password, email: email, reputation: 1}).then(function(err, result) {
            //console.log("1 verified user " + username + " added to VERIFIED USERS collection");
            if (retdict['status'] == 'OK') {
              console.log("Successfully verified " + username);
              res.json(retdict);
            }
            else {
              res.send(403, retdict);
            }
          }).catch(function(err) {
            console.log("Email not found error: " + username);
            retdict = {"status": "error", "error": "Email not found"};
            res.send(403, retdict);
          })
            }).catch(function(err) {
              console.log("error: " + username);
              retdict = {"status": "error", "error": "Error - verify"};
              res.send(403, retdict);
            })

        }
        // User from users database now verified and added to verified_users Database
        //console.log("InsertOne DB Connection closed");
})

app.get('/login', (req, res) => res.sendfile(path.join(__dirname + '/stackoverflowclonelogin.html')))

app.post('/login', (req, res) => {
  if (req.body.username == null) {
    res.send(403, {"status": "error", "error": "no username found"});
  }
  else if (req.body.password == null) {
    res.send(403, {"status": "error", "error": "no password found"});
  }
  else {
    var username = req.body.username;
    var password = req.body.password;
    var retdict = {"status":"OK"};

    // Determine that this user is verified
    sodb.collection("verified_users").findOne({"username": username}, function(err, result) {
      if (err) {
        retdict = {"status": "error", "error": "User is not verified"};
        res.send(403, retdict);
      }
      else if (result == null) {
        console.log("Nonexistent user - login");
        retdict = {"status":"error", "error": "User not verified or does not exist"};
        res.send(403, retdict);
      }
      else if (result.password !== password) {
        console.log("Wrong details - login");
        retdict = {"status": "error", "error": "Username and password do not match up."};
        res.send(403, retdict);
      }
      else {
        console.log("Entry found. Logging in: " + result.username);

        // If verified, put them in the session

        var token = jwt.sign({username: username}, 'so_clone');
        res.cookie('access_token', token, {secure: false, httpOnly: false});

        //console.log("Res headers");
        //console.log(res.header()._headers);

        res.status(200).send(retdict);
      }
    });
  }
})

app.post('/logout', (req, res) => {
  console.log("Logout called");
  //req.session.username = null;
  res.clearCookie("access_token"); // With cookies, how to change to their equivalent?
  user = null;

  res.json({"status": "OK"});
})

app.get('/questions/add', (req, res) => {
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) {
    console.log("No user logged in ");
    res.send(403, "No user logged in right now");
  }
  else {
    res.send("User logged in right now is: " + decoded.username);
  }
})

app.post('/questions/add', (req, res) => {
  var add_q_async = async function(req, res) {
    try {
            console.log("POST /questions/add");
            // Modify for handling media array
            var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
            // Base cases
            if (decoded == null) {
              console.log("No user logged in at add question - decoded null");
              res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
              return;
            }
            else if (decoded.username == null) {
              console.log("No user logged in at add question");
              res.send(403, {"status": "error", "error": "No user logged in"});
              return;
            }
            else if (req.body.title == null) {
              console.log("Null title");
              res.send(403, {"status": "error", "error": "No title for the question"});
              return;
            }
            else if (req.body.body == null) {
              console.log("Null body");
              res.send(403, {"status": "error", "error": "The question needs a body"});
              return;
            }
            else if (req.body.tags == null) {
              console.log("No tags");
              res.send(403, {"status": "error", "error": "The question needs at least one tag"});
              return;
            }
            else {
              //console.log("Valid add question case");
              var username = decoded.username;
              //console.log(username);
              var id = randomstring.generate();
              var retdict = {"status": "OK", "id": null};

              // HOW TO MAKE SURE THEIR REPUTATION IS NOT ALWAYS 1???
              var u_rep = 0;
              var add_media = [];
              var not_error = true;
              // First, get reputation
              console.log(username);

              var verified_users_collection = sodb.collection("verified_users");
              var r1 = await verified_users_collection.findOne({"username": username});
              u_rep = r1.reputation;

              if (req.body.media != null) {
                //console.log("has media");
                // If there is media, check each item of the media array to ensure that it exists in the Cassandra database, AND that it hasn't been used yet
                for (var i = 0; i < req.body.media.length && not_error; i++) {
                  var media_id = req.body.media[i];
                  //console.log("i = " + i + " and media id is " + media_id);

                  var media_collection = sodb.collection("media");
                  var r3 = await media_collection.findOne({"mid": media_id});

                  if (r3 == null) {
                    console.log("Null r3");
                    retdict = {"status": "error", "error": "Media file does not exist for this ID - error"}; // file doesn't exist
                    res.send(403, retdict);
                    return;
                  }
                  else if (r3.username != username) {
                    console.log(r3);
                    console.log("Bad username.  Media id " + media_id + " poster " + r3.username + " username " + username + " time " + Date.now());
                    retdict = {"status": "error", "error": "Only the original asker can use their media"};
                    res.send(403, retdict); // Ensure file can only be used by original asker
                    return;
                  }
                  else if (r3.used == true) {
                    console.log(r3);
                    console.log("Already used.  Media id " + media_id + " posted by " + r3.username + " username " + username + " time " + Date.now());
                    console.log("ALREADY USED ERROR");
                    retdict = {"status": "error", "error": "Media file " + media_id + " is already being used in another question/answer"};
                    res.send(403, retdict); // file is already used
                    return;
                  }
                  else {
                    //var new_used_dict = {$set: {used: true}}; // file isn't used and can be used for this question, mark it used
                    sodb.collection("media").updateOne({"mid": media_id}, {$set: {used: true}}, function(e4, r4) {
                      console.log("Marking media file " + media_id + " as true.");
                      if (e4) {
                        console.log(e4);
                        throw e4;
                      }
                      else if (retdict['status'] == "OK") {
                        console.log("Media with id " + media_id + " exists and is being marked true at time " + Date.now() + " by user " + username);
                        //console.log(r2);
                        console.log("Media exists");
                        //console.log(r3);
                      }
                    })
                  }

                  //console.log("End of for loop iteration");
                }
                // If the for loop completes, set the add_media var to our valid array of media ID's
                if (retdict['status'] == "error") {
                  console.log("Media error.  Leaving null");
                  add_media = [];
                }
                else {
                  add_media = req.body.media;
                  console.log(add_media);
                }
              }

              //console.log("Checking for error status");
              if (retdict['status'] == "error") {
                console.log("error status");
                not_error = false;
              }

              //console.log("Now on to the last part of the promise");

              // Create the question
              var obj = {"id": id, "user": {"username": decoded.username, "reputation": u_rep}, "title": req.body.title, "body": req.body.body, "score": 0, "view_count": 1, "answer_count": 0, "timestamp": Date.now() / 1000, "media": add_media, "tags": req.body.tags, "accepted_answer_id": null};
              var questions_collection = sodb.collection("questions");
              var r5 = await questions_collection.insertOne(obj);
              if (r5 == null) {
                console.log("Can't create question");
                retdict = {"status": "error", "error": "Error creating question at this time"};

                if (retdict['status'] == "error") {
                  console.log("Sending error status: " + retdict['error']);
                  res.status(403).send(retdict);
                  return;
                }
                else {
                  console.log("Status OK with media ");
                  res.status(200).send({"status":"OK", "id": id});
                  return;
                }
              }
              else {
                //console.log("Question successfully inserted into Questions collection");
                sodb.collection("answers").insertOne({"id": id, "answers": []}, function(err2, res2) {
                  if (err2) {
                    console.log("err2: " + err2);
                    throw err2;
                  }
                  //else console.log("Counterpart for this question in the answers collection also created.");
                })
                sodb.collection("views").insertOne({"id": id, "views": [], "upvotes": [], "downvotes": []}, function(err3, res3) {
                  if (err3) {
                    console.log("err2: " + err2);
                    throw err3;
                  }
                  //else console.log("Views component for this question also created.");
                })

                // Determine what status and JSON body to return at the very end
                if (retdict['status'] == "error") {
                  console.log("Sending error status: " + retdict['error']);
                  res.status(403).send(retdict);
                  return;
                }
                else {
                  console.log("Status OK with media ");
                  res.status(200).send({"status":"OK", "id": id});
                  return;
                }
              }
            }
          }
          catch (e) {
            console.log("error: " + e);
            res.status(403).send({"status": "error", "error": "Function error" + e});
          }
        }
      add_q_async(req, res);
})

app.get('/questions/:id', (req, res) => {
  const get_questions_func = async function(req) {
    try {
      // First determine if user is new - get username
      var username;
      var decoded = jwt.decode(req.cookies.access_token);
      //console.log(decoded);
      if (decoded == null) {
        username = request_ip.getClientIp(req);
      }
      else {
        username = decoded.username;
      }

      //console.log("Username " + username);

      // get id
      var id = req.params.id;
      //console.log("ID: " + id);

      // find question with that id
      var questions_collection = sodb.collection("questions");
      var r1 = await questions_collection.findOne({"id": id});
      if (r1 == null) { // no question with that id
        //console.log("Question not found");
        res.send(403, {"status": "error", "error": "Question not found"});
        return;
      }
      else { // question found
        //console.log("Question found");
        var new_view_count = r1.view_count;
        //console.log("View count: " + new_view_count);

        // Update view Count - if the user is NEW

        if (username == undefined || username == null) {
          //console.log("Username still undefined");
          username = request_ip.getClientIp(req);
        }

        var views_collection = sodb.collection("views");
        var r2 = await views_collection.findOne({"id": id});
        var views = r2.views;
        //console.log("Views " + views);
        var new_view_count = views.length;

        // if this condition triggers, user is new - increment view count
        if (views.indexOf(username) < 0) {
          // get old view count
          //console.log("Old view count: " + views.length);
          views.push(username); // insert new username into views array
          new_view_count = views.length;
          //console.log("New view count " + new_view_count);

          // Store new views dictionary
          var new_views_dict = {$set: {views: views}};
          var r3 = await views_collection.updateOne({"id": id}, new_views_dict);
          //console.log("New user, view count incremented");
          var new_view_count_dict = {$set: {view_count: new_view_count}};
          var r4 = await questions_collection.updateOne({"id": id}, new_view_count_dict);

        }

        // Ensure question data is properly updated
        var r5 = await questions_collection.findOne({"id": id});
        //console.log(r5);
        res.json({"status": "OK", "question": r5});
      }
    }
    catch (err) {
      if (err.name == "JsonWebTokenError") {
        console.log(err);
        var username = request_ip.getClientIp(req);
        //console.log("Username " + username);

        // get id
        var id = req.params.id;
        //console.log("ID: " + id);

        // find question with that id
        var questions_collection = sodb.collection("questions");
        var r1 = await questions_collection.findOne({"id": id});
        if (r1 == null) { // no question with that id
          console.log("Question not found");
          res.send(403, {"status": "error", "error": "Question not found"});
          return;
        }
        else { // question found
          //console.log("Question found");
          var new_view_count = r1.view_count;
          //console.log("View count: " + new_view_count);

          // Update view Count - if the user is NEW

          if (username == undefined || username == null) {
            //console.log("Username still undefined");
            username = request_ip.getClientIp(req);
          }

          var views_collection = sodb.collection("views");
          var r2 = await views_collection.findOne({"id": id});
          var views = r2.views;
          //console.log("Views " + views);
          var new_view_count = views.length;

          // if this condition triggers, user is new - increment view count
          if (views.indexOf(username) < 0) {
            // get old view count
            //console.log("Old view count: " + views.length);
            views.push(username); // insert new username into views array
            new_view_count = views.length;
            //console.log("New view count " + new_view_count);

            // Store new views dictionary
            var new_views_dict = {$set: {views: views}};
            var r3 = await views_collection.updateOne({"id": id}, new_views_dict);
            //console.log("New user, view count incremented");
            var new_view_count_dict = {$set: {view_count: new_view_count}};
            var r4 = await questions_collection.updateOne({"id": id}, new_view_count_dict);

          }

          // Ensure question data is properly updated
          var r5 = await questions_collection.findOne({"id": id});
          //console.log(r5);
          res.json({"status": "OK", "question": r5});
        }
      }
      else {
        res.send(403, {"status": "error", "error": "Error - Get question"});
      }
    }
  }

  get_questions_func(req);
})

app.post('/questions/:id/answers/add', (req, res) => {
  const get_answers_func = async function(req) {
    try {
      // console.log("Session for add answer");
      var id = req.params.id;
      //console.log(req.session);
      var uname = null;

      // First, check that a user is logged in
      var decoded = await jwt.verify(req.cookies.access_token, 'so_clone');
      if (decoded == null) res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
      else if (decoded.username == null) {
        console.log("No user logged in at POST 1 ");
        res.send(403, {"status": "error", "error": "No user logged in"});
      }
      else if (req.body.body == null) {
        console.log("NO BODY");
        res.send(403, {"status": "error", "error": "The answer needs a body"});
      }
      else {
        uname = decoded.username;
        console.log(uname);
        var answers_collection = sodb.collection("answers");
        var questions_collection = sodb.collection("questions");
        var r1 = await answers_collection.findOne({"id": id});
        if (r1 == null) {
          console.log("Nonexistent question");
          res.send(403, {"status": "error", "error": "A question with this ID does not exist."});
        }
        else {
          var answerid = randomstring.generate();
          var a_media = [];
          var not_error = true;
          var retdict = {"status": "OK"};
          if (req.body.media != null) {
            //console.log("has media");
            // If there is media, check each item of the media array to ensure that it exists in the Cassandra database, AND that it hasn't been used yet
            for (var i = 0; i < req.body.media.length && not_error; i++) {
              var media_id = req.body.media[i];
              // console.log("i = " + i + " and media id is " + media_id);

              var media_collection = sodb.collection("media");
              var r2 = await media_collection.findOne({"mid": media_id});

              if (r2 == null) {
                console.log("Null r2");
                retdict = {"status": "error", "error": "Media file does not exist for this ID - error"}; // file doesn't exist
                res.send(403, retdict);
                return;
              }
              else if (r2.username != uname) {
                console.log(r2);
                console.log("Bad username.  Media id " + media_id + " poster " + r2.username + " username " + uname + " time " + Date.now());
                retdict = {"status": "error", "error": "Only the original asker can use their media"};
                res.send(403, retdict); // Ensure file can only be used by original asker
                return;
              }
              else if (r2.used) {
                console.log(r2);
                console.log("Already used.  Media id " + media_id + " posted by " + r2.username + " username " + uname + " time " + Date.now());
                retdict = {"status": "error", "error": "Media file " + media_id + " is already being used in another question/answer"};
                res.send(403, retdict);
                return; // file is already used
              }
              else {
                //var new_used_dict = {$set: {used: true}}; // file isn't used and can be used for this question, mark it used
                var r4 = await media_collection.updateOne({"mid": media_id}, {$set: {used: true}});
                if (r4 == null) {
                  retdict = {"status": "error", "error": "r4 invalid"};
                }
                else if (retdict['status'] == "OK") {
                  //console.log("Media with id " + media_id + " exists and is being marked true at time " + Date.now() + " by user " + uname);
                  //console.log(r2);
                  //console.log("Media exists");
                  //console.log(r3);
                }
              }

              //console.log("Checking for error status");
              if (retdict['status'] == "error") {
                console.log("error status");
                not_error = false;
              }

              //console.log("End of for loop iteration");
            }
            // If the for loop completes, set the add_media var to our valid array of media ID's
            if (retdict['status'] == "error") {
              a_media = [];
            }
            else {
              a_media = req.body.media;
            }
            //console.log(a_media);
          }
          var answerobj = {"id": answerid, "user": uname, "body": req.body.body, "score": 0, "is_accepted": false, "timestamp": Date.now() / 1000, "media": a_media, "upvotes": [], "downvotes": []};

          var answers_arr = r1.answers;
          if (answers_arr == null) {
            console.log("Null answers_arr");
            answers_arr = [];
          }
          //console.log("previous answer count " + answers_arr.length);
          answers_arr.push(answerobj);
          //console.log("new answer count " + answers_arr.length);

          var new_answer_arr = {$set: {answers: answers_arr}};

          // Update DB Entry
          var r5 = await answers_collection.updateOne({"id": id}, new_answer_arr);
          var r7 = await questions_collection.updateOne({"id": id}, {$set: {answer_count: answers_arr.length}});
          if (r5 == null) {
            res.send(403, {"status": "error", "error": "Error when updating answers database"});
          }
          else if (r7 == null) {
            res.send(403, {"status": "error", "error": "Error when updating answer count in questions database"});
          }
          else if (retdict['status'] == "error") {
            res.send(403, retdict);
          }
          else {
            var r6 = await answers_collection.findOne({"id": id});
            if (r6 != null) {
              console.log(r6);
            }
            //console.log("Answer added: " + answerid);
            res.json({"status": "OK", "id": answerid});
          }
        }
      }
    }
    catch (err) {
      //throw err;
      console.log("Error: " + err);
      res.send(403, {"status": "error", "error": "Error - add answer" + err});
    }
  }
  get_answers_func(req);
})

app.get('/questions/:id/answers', (req, res) => {
    const get_answers_func = async function(req) {
      try {
        //console.log("Trying to get answer");
        var id = req.params.id;
        //console.log(id);

        var answers_collection = sodb.collection("answers");
        var result = await answers_collection.findOne({"id": id});
        if (result == null) {
          console.log("Nothing found");
          res.send(403, {"status": "error", "error": "No such question exists with this ID"});
        }
        else {
          //console.log(result);
          //console.log(result.answers);
          res.json({"status": "OK", "answers": result.answers});
        }
      }
      catch (e) {
        console.log("Error");
        res.send(403, {"status": "error", "error": "Error - get answer"});
      }
    }
    get_answers_func(req);
})

const search_by_options = {
  TIMESTAMP: "timestamp",
  SCORE: "score"
}

app.post('/search', (req, res) => {
  var timestamp = Date.now() / 1000;
  var limit = 25;
  var search_q = null;
  // New M3 additions
  var sort_by = search_by_options.SCORE;
  var tags = [];
  var has_media = false;
  var accepted = false;

  if (req != null && req.body != null) {
    console.log(req.body);
    if (req.body.q != null) {
      if (req.body.q != "" && !(req.body.q.match(/^\s*$/))) {
        console.log(req.body.q);
        search_q = req.body.q;
      }
      else {
        console.log("String of ONLY WHITESPACES");
      }
    }
    if (req.body.timestamp != null) {
      console.log("Setting timestamp");
      timestamp = req.body.timestamp;
      console.log(timestamp);
    }

    if (req.body.limit != null && req.body.limit >= 0 && req.body.limit <= 100) {
      console.log("Setting limit");
      limit = req.body.limit;
    }

    if (req.body.accepted != null) {
      console.log("Setting accepted");
      accepted = req.body.accepted;
    }

    if (req.body.sort_by != null) {
      console.log("Setting sort by");
      if (req.body.sort_by == "timestamp") {
        console.log("To timestamp");
        sort_by = search_by_options.TIMESTAMP;
      }
      else if (req.body.sort_by == "score") {
        console.log("To score");
        sort_by = search_by_options.SCORE;
      }
      else {
        console.log("Incompatible sort_by input.  sort_by stays at score");
      }
    }

    if (req.body.tags != null) {
      console.log("Setting tags array");
      tags = req.body.tags;
    }

    if (req.body.has_media != null) {
      console.log("Setting has_media");
      has_media = req.body.has_media;
    }

    var query = {"timestamp": {$lte: timestamp}};
    var query_and_arr = [query];
    if (search_q != null) {
      //console.log("Modifying query");
      query_and_arr.push({"$text": {"$search": search_q}});
      // remember to CREATE SEARCH INDEX in the questions db for this: db.questions.createIndex({"title": "text", "body": "text"})
      //query = {$and:[{"timestamp": {$lte: timestamp}}, {"$text": {"$search": search_q}}]}; // Add a search query here
      query = {$and: query_and_arr};
    }

    if (has_media) {
      query_and_arr.push({"media":{$exists: true, $not: {$size: 0}}});
      query = {$and: query_and_arr};
    }

    if (accepted) {
      query_and_arr.push({"accepted_answer_id": {$ne: null}});
      query = {$and: query_and_arr};
    }

    if (tags.length > 0) {
      query_and_arr.push({ tags: { $all: tags } })
      query = {$and: query_and_arr};
    }

    var sorter = {"timestamp": -1};
    if (sort_by == search_by_options.SCORE) {
      sorter = {"score": -1};
    }
    else if (sort_by == search_by_options.TIMESTAMP) {
      sorter = {"timestamp": -1};
    }

    sodb.collection("questions").find(query).sort(sorter).limit(limit).toArray(function(err, result) {
      if (err) {
        console.log("Throw error");
        throw err;
      }
      else {
        if (result != null) {
          //console.log("Search results:");
          //console.log(result);

          res.json({"status": "OK", "questions": result});
        }
        else {
          console.log("Error");
          res.send(403, {"status": "error", "error": "Error - search"});
        }
      }
    })
  }
  else {
    res.send(403, {"status": "error", "error": "Error: No request body"});
  }
})

// Milestone 2 new functions

app.delete('/questions/:id', (req, res) => {
  var delete_q_function = async function(req, res) {
    try {
      var decoded = await jwt.verify(req.cookies.access_token, 'so_clone');
      if (decoded == null) res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
      else if (decoded.username == null) {
        res.send(403,"You do not have rights to do this!");
        return;
      }
      else {
        console.log(decoded);
        var id = req.params.id;

        var questions_collection = sodb.collection("questions");
        var answers_collection = sodb.collection("answers");
        var media_collection = sodb.collection("media");

        var r1 = await questions_collection.findOne({id: id});
        var r5 = await answers_collection.findOne({id: id});
        if (r1 == null) {
          console.log("error r1");
          res.send(403, {"status": "error", "error": "Error r1: question not found"});
          return;
        }
        console.log(r1);
        console.log(decoded.username);
        console.log(r1.user['username']);
        if (r1.user['username'] != decoded.username) {
          console.log("not original asker error");
          res.send(403,"You do not have rights to do this!");
          return;
        }
        else {
          // Delete all media components from cassandra - QUESTION
          var q_media_array = r1.media;
          console.log(q_media_array);

          if (q_media_array.length > 0) {
            for (var i = 0; i < q_media_array.length; i++) {
              var media_id = q_media_array[i];
              console.log(media_id);
              const query = 'DELETE FROM media WHERE id = ?';
              const params = [media_id];

              cassandra_client.execute(query, params, { prepare: true }, function (err2) {
                if (err2) {
                  console.log("err2: " + err2);
                  throw err2;
                }
                console.log("Deleting ... successfully deleted id with " + media_id);
              });

              var r4 = await media_collection.deleteOne({mid: media_id});
              /*if (r4 == null) {
                console.log("e4");
                res.send(403, {"status": "error", "error": "error r4"});
              }*/
            }
          }

          // Delete all media components from cassandra associated with ANY ANSWERS
          if (r5 != null) {
            var answers_arr = r5.answers;

            for (var i = 0; i < answers_arr.length; i++) {
              var a_media_array = answers_arr[i].media;

              for (var j = 0; j < a_media_array.length; j++) {
                var a_media_id = a_media_array[j];
                //console.log(a_media_id);
                const query = 'DELETE FROM media WHERE id = ?';
                const params = [a_media_id];

                cassandra_client.execute(query, params, { prepare: true }, function (err2) {
                  if (err2) {
                    console.log("err2: " + err2);
                    throw err2;
                  }
                  //console.log("Deleting ... successfully deleted id with " + a_media_id);
                });

                var r6 = await media_collection.deleteOne({mid: a_media_id});
                if (r6 == null) {
                  console.log("e6");
                  res.send(403, {"status": "error", "error": "error r4"});
                }
              }
            }
          }

          // Delete question
          var r2 = await questions_collection.deleteOne({id: id});
          if (r2 == null) {
            console.log("e2");
            res.send(403, {"status": "error", "error": "Error r2: question not found"});
            return;
          }
          //else console.log("1 question document deleted");

          // Delete answer
          var r3 = await answers_collection.deleteOne({id: id});
          if (r3 == null) {
            console.log("e3");
            res.send(403, {"status": "error", "error": "Error r3: question not found"});
            return;
          }
          else console.log("1 answers document deleted");

          console.log("Success.  Returning OK");
          res.json({"status": "OK"});
        }

      }
    }
    catch (err) {
      res.send(403, {"status": "error", "error": "Error : " + err});
    }
  }

  delete_q_function(req, res);
})

app.get('/user/:username', (req, res) => {
  const get_user_func = async function(req, res) {
    try {
      console.log("/get/user/username");
      var username = req.params.username;
      var verified_users_collection = sodb.collection("verified_users");
      var result = await verified_users_collection.findOne({username: username});
      if (result == null) {
        console.log(username + " does not exist");
        res.send(403, {"status": "error", "error": "User does not exist"});
      }
      else {
        //console.log("user found");

        // Obtain the user details
        var email = result.email;
        var rep = result.reputation;

        // Return the user details
        res.json({"status": "OK", "user": {"email": email, "reputation": rep}});
      }

    }
    catch (e) {
      res.json({"status": "error", "error": "error in get user"});
    }
  }
  get_user_func(req, res);
})

app.get('/user/:username/questions', (req, res) => {
  /*var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) {
    res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
    return;
  }*/
  var username = req.params.username;
  //console.log("Username is " + username);
  // Find all questions where user['username'] is the given username

  sodb.collection("questions").find({"user.username": username}).toArray(function (err, result) {
    if (err) throw err;

    // return the array of Question ID's - iterate through result
    var q_id_arr = [];

    result.forEach(e => {
      q_id_arr.push(e.id);
    })

    //console.log(result);
    //console.log(q_id_arr);

    res.json({"status": "OK", "questions": q_id_arr});
  })
})

app.get('/user/:username/answers', (req, res) => {
  /*var decoded = await jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) {
    res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
    return;
  }*/
  var username = req.params.username;
  // Find all answers where user['username'] is the given username

  var sorter = {"timestamp": -1}
  sodb.collection("answers").find().sort(sorter).toArray(function (err, result) {
    if (err) throw err;

    // return the array of Question ID's
    var a_id_arr = [];

    //console.log(result);

    result.forEach (e => {
      var ans = e.answers;

      //console.log(ans);
      ans.forEach(f => {
        if (f.user == username) {
          a_id_arr.push(f.id);
        }
      })
    })

    res.json({"status": "OK", "answers": a_id_arr});
  })
})

// Milestone 3 new functionality
// Rough draft for UPVOTE functions - CONVERTED TO async
app.post("/questions/:id/upvote", (req, res) => {
  var q_upvote = async function(req, res) {
    try {
      var id = req.params.id;
      var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
      if (decoded == null) {
        res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
        return;
      }
      var username = decoded.username;

      if (username == null) {
        console.log("No user logged in");
        res.send(403, {"status": "error", "error": "No user logged in"});
        return;
      }

      var q_username = null;
      var questions_collection = sodb.collection("questions");
      var views_collection = sodb.collection("views");
      var verified_users_collection = sodb.collection("verified_users");

      var question = await questions_collection.findOne({"id": id});
      if (question == null) {
        res.send(403, {"status": "error", "error": "No question found"});
        return;
      }
      else {
        q_username = question.user.username;
      }

      var upvotes = null; var downvotes = null;
      var vote = true;
      if (req.body.upvote != null) {
        vote = req.body.upvote;
      }

      var views_result = await views_collection.findOne({"id": id});
      if (views_result == null) {
        res.send(403, {"status": "error", "error": "No element found in views collection"});
        return;
      }
      else {
        upvotes = views_result.upvotes;
        downvotes = views_result.downvotes;
      }

      if (vote == true) {
          // First, make sure the person isn't upvoting twice
          if (upvotes.indexOf(username) >= 0) {
            //console.log("User has already upvoted.  Undoing upvote.");
            upvotes.splice(upvotes.indexOf(username), 1);

            var new_score = upvotes.length - downvotes.length;

            var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};

            var r1 = await views_collection.updateOne({'id': id}, new_views_dict);
            if (r1 == null) {
              res.send(403, {"status": "error", "error": "error r1"});
            }
            //else console.log("Votes updated - DOWNVOTE");

            var r2 = await questions_collection.updateOne({"id": id}, {$set: {"score": new_score}});
            if (r2 == null) {
              res.send(403, {"status": "error", "error": "error r2"});
              return;
            }
            //else console.log("Question reputation updated - DOWNVOTE");

            var verified_user = await verified_users_collection.findOne({"username": q_username});
            if (verified_user == null) {
              res.send(403, {"status": "error", "error": "error no verified user found"});
            }
            else {
              var old_rep = verified_user.reputation;
              if (old_rep > 1) {
                var r3 = await verified_users_collection.updateOne({"username": q_username}, {$set: {"reputation": old_rep - 1}});
                if (r3 == null) {
                  res.send(403, {"status": "error", "error": "error r3"});
                  return;
                }
                else {
                  //console.log("User reputation updated - DOWNVOTE");
                }
              }
              else {
                //console.log("Can't downvote user's reputation further");
              }
            }

            res.json({"status": "OK"});
            return;
          }
          else if (downvotes.indexOf(username) >= 0) { // case if user is in the downvotes array
            downvotes.splice(downvotes.indexOf(username), 1);
          }
          //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length);

          upvotes.push(username);

          var new_score = upvotes.length - downvotes.length;
          //console.log("New reputation: " + new_score);

          var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};
          var r4 = await views_collection.updateOne({'id': id}, new_views_dict);
          if (r4 == null) {
            res.send(403, {"status": "error", "error": "error r4"});
          }
          //else console.log("Votes updated - UPVOTE");

          var r5 = await questions_collection.updateOne({"id": id}, {$set: {"score": new_score}});
          if (r5 == null) {
            res.send(403, {"status": "error", "error": "error r5"});
          }
          //else console.log("Question reputation updated - UPVOTE");

          var r6 = await verified_users_collection.findOne({"username": q_username});
          if (r6 == null) {
            res.send(403, {"status": "error", "error": "error r6"});
            return;
          }
          else {
            var old_rep = r6.reputation;
            var r7 = await verified_users_collection.updateOne({"username": q_username}, {$set: {"reputation": old_rep + 1}});
            if (r7 == null) {
              res.send(403, {"status": "error", "error": "error r7"});
              return;
            }
            //else console.log("User reputation updated - DOWNVOTE");
          }

        res.json({"status": "OK"});
      }
      else { // results r8 and above
        var r8 = await questions_collection.findOne({"id": id});
        if (r8 == null) {
          res.send(403, {"status": "error", "error": "error r8"});
          return;
        }

        if (downvotes.indexOf(username) >= 0) {
            //console.log("Cannot downvote twice.  Undoing downvote.");
            downvotes.splice(downvotes.indexOf(username), 1);
            var new_score = upvotes.length - downvotes.length;
            var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};

            var r9 = await views_collection.updateOne({'id': id}, new_views_dict);
            if (r9 == null) {
              res.send(403, {"status": "error", "error": "error r9"});
              return;
            }
            //else console.log("Votes updated - DOWNVOTE");

            var r10 = await questions_collection.updateOne({"id": id}, {$set: {"score": new_score}});
            if (r10 == null) {
              res.send(403, {"status": "error", "error": "error r10"});
              return;
            }
            //else console.log("Question reputation updated - DOWNVOTE");

            var r11 = await verified_users_collection.findOne({"username": q_username});
            if (r11 == null) {
              res.send(403, {"status": "error", "error": "error r11"});
              return;
            }
            var old_rep = r11.reputation;
            var r12 = await verified_users_collection.updateOne({"username": q_username}, {$set: {"reputation": old_rep + 1}});
            if (r12 == null) {
              res.send(403, {"status": "error", "error": "error r12"});
              return;
            }
            //else console.log("User reputation updated - DOWNVOTE");

            res.json({"status": "OK"});
            return;
          }
          else if (upvotes.indexOf(username) >= 0) {
            upvotes.splice(upvotes.indexOf(username));
          }

          downvotes.push(username);

          var new_score = upvotes.length - downvotes.length;
          var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};
          // vars r13 and up
          var r13 = await views_collection.updateOne({'id': id}, new_views_dict);
          if (r13 == null) {
            res.send(403, {"status": "error", "error": "error r13"});
            return;
          }
          //else console.log("Votes updated - DOWNVOTE");

          var r14 = await questions_collection.updateOne({"id": id}, {$set: {"score": new_score}});
          if (r14 == null) {
            res.send(403, {"status": "error", "error": "error r14"});
            return;
          }
          //else console.log("Question reputation updated - DOWNVOTE");

          var r15 = await verified_users_collection.findOne({"username": q_username});
          if (r15 == null) {
            res.send(403, {"status": "error", "error": "error r15"});
            return;
          }
          else {
            var old_rep = r15.reputation;
            if (old_rep > 1) {
              var r16 = await verified_users_collection.updateOne({"username": q_username}, {$set: {"reputation": old_rep - 1}});
              if (r16 == null) {
                res.send(403, {"status": "error", "error": "error r16"});
                return;
              }
              //else console.log("User reputation updated - DOWNVOTE");
            }
            else {
              //console.log("Can't downvote user's reputation further");
            }
          }

          res.json({"status": "OK"});
          return;
      }
    }
    catch (e) {
      res.send(403, {"status": "error", "error": "error" + e});
    }
  }
  q_upvote(req, res);
})

app.post("/answers/:id/upvote", (req, res) => {
  var a_upvote = async function(req, res) {
    try {
      var id = req.params.id;

      // Check that user is logged in
      var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
      if (decoded == null) {
        res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
        return;
      }
      var username = decoded.username;

      if (username == null) {
        console.log("No user logged in");
        res.send(403, {"status": "error", "error": "No user logged in"});
        return;
      }

      // Set default for upvote and change it if the body param is provided
      var vote = true;
      if (req.body.upvote != null) {
        vote = req.body.upvote;
      }

      var answers_collection = sodb.collection("answers");
      var verified_users_collection = sodb.collection("verified_users");

      var r1 = await answers_collection.findOne({"answers.id": id}, {"answers": {$elemMatch: {"id": id}}});
      if (r1 == null) {
        res.send(403, {"status": "error", "error": "error r1"});
        return;
      }

      //console.log(r1);
      //console.log("End of answers result");

      var answer = r1.answers.find(x => x.id === id); // if not compatible, maybe use lodash here?
      //console.log(answer);

      // given our answer, now upvote/downvote it, and change score accordingly
      var score = answer.score;
      var upvotes = answer.upvotes;
      var downvotes = answer.downvotes;
      // How to update the answer dictionary, then update the array, then update the answers entry with the new array?

      var a_username = answer.user;

      if (vote == true) { // upvote answer or undo upvote
        // First, make sure the person isn't upvoting twice
        if (upvotes.indexOf(username) >= 0) {
          //console.log("User has already upvoted answer.  Undoing upvote for ANSWER.");
          //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length);
          upvotes.splice(upvotes.indexOf(username), 1);
          var new_ans_score = upvotes.length - downvotes.length;
          //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length + " after answer spliced from downvotes");
          //console.log("New answer score: " + new_ans_score);

          answer.upvotes = upvotes;
          answer.downvotes = downvotes;
          answer.score = new_ans_score;

          // How to update the answer dictionary, then update the array, then update the answers entry with the new array?
          var answerUpdateIndex = r1.answers.findIndex(x => x.id === id);
          if (answerUpdateIndex >= 0) {
            r1.answers[answerUpdateIndex] = answer;

            var r4 = await answers_collection.updateOne({"answers.id": id}, {$set: {"answers" : r1.answers}});
            if (r4 == null) {
              res.send(403, {"status": "error", "error": "error r4"});
              return;
            }
            else {
              //console.log("Answers array updated ... hopefully");
            }
          }

          var r2 = await verified_users_collection.findOne({"username": a_username});
          if (r2 == null) {
            res.send(403, {"status": "error", "error": "error r2"});
            return;
          }
          var old_rep = r2.reputation;
          if (old_rep > 1) {
            var r3 = await verified_users_collection.updateOne({"username": a_username}, {$set: {"reputation": old_rep - 1}});
            if (r3 == null) {
              res.send(403, {"status": "error", "error": "error r3"});
              return;
            }
            //else console.log("User reputation updated - DOWNVOTE (duplicate upvote)");
          }
          else {
            //console.log("Can't downvote user's reputation further");
          }

          res.json({"status": "OK"});
          return;
        }
        else if (downvotes.indexOf(username) >= 0) { // case if user is in the downvotes array
          //console.log("Downvote to upvote");
          downvotes.splice(downvotes.indexOf(username), 1);
        }
        //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length);

        upvotes.push(username);
        answer.upvotes = upvotes;
        answer.downvotes = downvotes;
        //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length + " after answer pushed in");
        var new_ans_score = upvotes.length - downvotes.length;
        //console.log("New answer reputation: " + new_ans_score);
        answer.score = new_ans_score;

        // How to update the answer dictionary, then update the array, then update the answers entry with the new array?
        var answerUpdateIndex = r1.answers.findIndex(x => x.id === id);
        if (answerUpdateIndex >= 0) {
          r1.answers[answerUpdateIndex] = answer;

          var r4 = await answers_collection.updateOne({"answers.id": id}, {$set: {"answers" : r1.answers}});
          if (r4 == null) {
            res.send(403, {"status": "error", "error": "error r4"});
            return;
          }
          else {
            //console.log("Answers array updated ... hopefully");
          }
        }

        var r5 = await verified_users_collection.findOne({"username": a_username});
        if (r5 == null) {
          res.send(403, {"status": "error", "error": "error r5"});
          return;
        }
        var old_rep = r5.reputation;
        var r6 = await verified_users_collection.updateOne({"username": a_username}, {$set: {"reputation": old_rep + 1}});
        if (r6 == null) {
          res.send(403, {"status": "error", "error": "error r6"});
          return;
        }
        //else console.log("User reputation updated from ANSWER - UPVOTE");

        res.json({"status": "OK"});
      }
      else { // downvote answer or undo downvote
        if (downvotes.indexOf(username) >= 0) { // Undo downvote
          //console.log("Cannot downvote twice.  Undoing downvote.");

          //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length);
          downvotes.splice(downvotes.indexOf(username), 1);
          //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length + " after answer spliced from downvotes");

          var new_score = upvotes.length - downvotes.length;
          //console.log("New answer reputation: " + new_ans_score);

          answer.upvotes = upvotes;
          answer.downvotes = downvotes;
          answer.score = new_score;

          // How to update the answer dictionary, then update the array, then update the answers entry with the new array?
          var answerUpdateIndex = r1.answers.findIndex(x => x.id === id);
          if (answerUpdateIndex >= 0) {
            r1.answers[answerUpdateIndex] = answer;

            var r7 = await answers_collection.updateOne({"answers.id": id}, {$set: {"answers" : r1.answers}});
            if (r7 == null) {
              res.send(403, {"status": "error", "error": "error r7"});
              return;
            }
            else {
              //console.log("Answers array updated ... hopefully");
            }
          }

          var r8 = await verified_users_collection.findOne({"username": a_username});
          if (r8 == null) {
            res.send(403, {"status": "error", "error": "error r8"});
            return;
          }
          var old_rep = r8.reputation;
          var r9 = await verified_users_collection.updateOne({"username": a_username}, {$set: {"reputation": old_rep + 1}});
          if (r9 == null) {
            res.send(403, {"status": "error", "error": "error r9"});
            return;
          }
          //else console.log("User reputation updated - UPVOTE (undo downvote)");

          res.json({"status": "OK"});
          return;
        }
        else if (upvotes.indexOf(username) >= 0) {
          upvotes.splice(upvotes.indexOf(username));
        }

        //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length);
        downvotes.push(username);
        //console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length + " after answer pushed to downvotes");

        var new_score = upvotes.length - downvotes.length;
        //console.log("New answer reputation: " + new_ans_score);
        answer.score = new_score;
        answer.upvotes = upvotes;
        answer.downvotes = downvotes;

        // How to update the answer dictionary, then update the array, then update the answers entry with the new array?
        var answerUpdateIndex = r1.answers.findIndex(x => x.id === id);
        if (answerUpdateIndex >= 0) {
          r1.answers[answerUpdateIndex] = answer;

          var r10 = await answers_collection.updateOne({"answers.id": id}, {$set: {"answers" : r1.answers}});
          if (r10 == null) {
            res.send(403, {"status": "error", "error": "error r10"});
            return;
          }
          else {
            //console.log("Answers array updated ... hopefully");
          }
        }

        var r11 = await verified_users_collection.findOne({"username": a_username});
        if (r11 == null) {
          res.send(403, {"status": "error", "error": "error r11"});
          return;
        }
        var old_rep = r11.reputation;
        if (old_rep > 1) {
          var r12 = await verified_users_collection.updateOne({"username": a_username}, {$set: {"reputation": old_rep - 1}});
          if (r12 == null) {
            res.send(403, {"status": "error", "error": "error r12"});
            return;
          }
          //else console.log("User reputation updated - DOWNVOTE");
        }
        else {
          //console.log("Can't downvote user's reputation further");
        }

        res.json({"status": "OK"});
      }
    }
    catch (e) {
      res.send(403, {"status": "error", "error": "e: " + e});
    }
  }

  a_upvote(req, res);

})

app.post("/answers/:id/accept", (req, res) => {
  var id = req.params.id;

  // Check that user is logged in
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) {
    res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
    return;
  }
  var username = decoded.username;

  if (username == null) {
    //console.log("No user logged in");
    res.send(403, {"status": "error", "error": "No user logged in - accept answer"});
    return;
  }
  sodb.collection("answers").findOne({"answers.id": id}, {"answers": {$elemMatch: {"id": id}}}, function(err, result) {
    if (err) throw err;
    var answer = result.answers.find(x => x.id === id);
    sodb.collection("questions").findOne({id: result.id}, function(e1, r1) {
      if (e1) throw e1;
      else if (r1.user['username'] != username) {
        res.send(403, {"status": "error", "error": "You do not have rights to accept an answer"});
      }
      else {
        if (r1.accepted_answer_id == null) {
          sodb.collection("questions").updateOne({id: result.id}, {$set: {accepted_answer_id: id}}, function(e2, r2) {
            if (e2) throw e2;
            else {
              //console.log("Answer accepted!");
              res.json({"status": "OK"});
            }
          })
        }
        else {
          res.send(403, {"status": "error", "error": "There is already an accepted answer for this question"});
        }
      }
    })
  })
})

// Takes in FORM DATA, you may need to install something like multer
app.post("/addmedia", upload.single('content'), (req, res) => {
  //console.log("add media");
  // Check that user is logged in
  jwt.verify(req.cookies.access_token, 'so_clone', function(err, decoded) {
    if (err || decoded == null) {
      console.log("User not found");
      res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
      return;
    }
    var username = decoded.username;

    if (username == null) {
      console.log("No user logged in");
      res.send(403, {"status": "error", "error": "No user logged in - add media"});
      return;
    }

    var buffer = req.file.buffer;

    var fileId = randomstring.generate();

    // Extract data from file
    var content;
    fs.readFile(req.file['path'], function read(err, data) {
      if (err) {
          console.log("Read file error");
          throw err;
      }
      content = data;

      console.log(content);

      const query = 'INSERT INTO media (id, content, filename) VALUES (?, ?, ?)';
      const params = [fileId, content, req.file['filename']];
      cassandra_client.execute(query, params, { prepare: true }, function (err2) {
        //console.log("Hopeful blob content being added");
        //console.log(content);
        //console.log(err2); // if no error, undefined
        //console.log("Inserted into Cluster media file with id " + fileId);
        if (err2) {
          res.send(403, {"status": "error", "error": "Media error"});
        }
        else {
          sodb.collection("media").insertOne({"mid": fileId, "used": false, "username": username}, function(err3, res3) {
            if (err3) throw err3;
          })
          res.json({"status": "OK", "id": fileId});
        }
      });
    });


  })
})

app.get("/media/:id", (req, res) => {
  var id = req.params.id;
  //console.log("Media id: " + id);

  const query = "SELECT content FROM media WHERE id = ?";
  const params = [id];
  cassandra_client.execute(query, params, {prepare: true}, function (err, result) {
    if (err) {
      console.log(err);
      res.send(403, {"status": "error", "error": "No media file found"});
    }
    else if (result == null || result == undefined) {
      console.log("Not found");
      res.send(403, {"status": "error", "error": "No media file found"});
    }
    else {

      if (result.rows.length == 0 || result.rows == null) {
        console.log("No rows in the table");
        res.send(403, {"status": "error", "error": "no rows/content"});
        return;
      }

		  res.send(200, result.rows[0].content);
    }
  });
})

// Reset functions
app.get("/dbreset", (req, res) => {
      console.log("DB reset");

      // drop all the existing collections one by one, then recreate them all
      var drop_collections = async function() {
      sodb.collection("users").drop(function(err, delOK) {
        if (err) throw err;
        if (delOK) console.log("Users collection deleted");
      });

      sodb.collection("verified_users").drop(function(err, delOK) {
        if (err) throw err;
        if (delOK) console.log("Verified Users collection deleted");
      });

      sodb.collection("questions").drop(function(err, delOK) {
        if (err) throw err;
        if (delOK) console.log("Questions collection deleted");
      });

      sodb.collection("answers").drop(function(err, delOK) {
        if (err) throw err;
        if (delOK) console.log("Answers collection deleted");
      });

      sodb.collection("views").drop(function(err, delOK) {
        if (err) throw err;
        if (delOK) console.log("Views collection deleted");
      });

      sodb.collection("media").drop(function(err, delOK) {
        if (err) throw err;
        if (delOK) console.log("Media collection deleted");
      });

      sodb.collection("answer_list").drop(function(err, delOK) {
        if (err) throw err;
        if (delOK) console.log("Answerlist collection deleted");
      });
      }


      // Create collections for Users, then Verified Users
      var recreate_collections = async function() {
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

      sodb.createCollection("views", function(err, res) {
        if (err) throw err;
        console.log("Views collection created");
      })

      sodb.createCollection("userbackup", function(err, res) {
        if (err) throw err;
        console.log("Backup user collection created");
      })

      sodb.createCollection("answer_list", function(err, res) {
        if (err) throw err;
        console.log("Created answer list");
      })

      sodb.createCollection("media", function(err, res) {
        if (err) throw err;
        console.log("Created media use records");
      })

      }

      var recreate_index = async function() {
        sodb.collection("questions").createIndex({"title": "text", "body": "text"}, function(err, res) {
          if (err) throw err;
          console.log("Created questions index for use during searching.");
        })
      }
  drop_collections(); recreate_collections(); recreate_index();
  res.send("MongoDB reset");
})

app.post("/reset", (req, res) => { // Reset cassandra
  const query = 'TRUNCATE media;';
  const params = [];
  cassandra_client.execute(query, params, { prepare: true }, function (err2) {
    console.log("Clearing Cassandra Media table");
    console.log(err2); // if no error, undefined
    console.log("Cleared");
    if (err2) {
      res.send(403, {"status": "error", "error": "Error clearing cassandra table"});
    }
    else {
      res.send("Cassandra DB media table truncated");
    }
  });
})


app.listen(port, () => console.log(`Example app listening on port ${port}!`))
