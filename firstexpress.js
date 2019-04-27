// REMEMBER TO MAKE SURE ALL PACKAGES - denoted by require('package_name') are installed when porting over to a remote instance
const express = require('express')
var cookieParser = require('cookie-parser')
const app = express()
const port = 3000;
app.use(cookieParser())

//var jwt = require('express-jwt');
const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
var NodeSession = require('node-session');
var session = require('express-session');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(express.json());

const ip = require('ip');
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

// Adding session support
// init
/*app.use(session({
  secret: 'keyboard cat',
  store: new MongoStore({url: url + "stackoverflowclone", collection: "sessions"}),
  resave: false,
  saveUninitialized: true,
  cookie: {}
}))

app.use(function (req, res, next) {
  if (!req.session.views) {
    req.session.views = {};
  }

  next();
})*/

cassandra_client.connect(function (err) {
  console.log("Connected to Cassandra DB");
  console.log(Object.keys(cassandra_client.metadata.keyspaces));
});

var accessLogStream = fs.createWriteStream('/home/ubuntu/.pm2/logs/'+ '/access.log',{flags: 'a'});
// setup the logger
app.use(morgan('combined', {stream: accessLogStream}));

// Milestone 1

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

    // Send key to the given email
    //console.log("Generating key");
    var key = "abracadabra";
    var email = req.body.email;
    console.log(email);

      var myobj = { username: username, email: email, password: password, key: key};
      sodb.collection("users").insertOne(myobj, function(err, res) {
        if (err) throw err;
        //console.log("1 document inserted into USERS collection");
        //db.close();
      });

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
        console.log('Email sent: ' + info.response);
      }
    });

    res.json({"status": "OK"});
  }
})

app.post('/verify', (req, res) => {
  if (req.body.email == null) {
    res.send(403, {"status": "error", "error": "no email found"});
  }
  else if (req.body.key == null) {
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
      console.log(result);
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
            //console.log("1 verified user added to VERIFIED USERS collection");
            if (retdict['status'] == 'OK') {
              res.json(retdict);
            }
            else {
              res.send(403, retdict);
            }
          }).catch(function(err) {
            //console.log("Email not found error");
            retdict = {"status": "error", "error": "Email not found"};
            res.send(403, retdict);
          })
            }).catch(function(err) {
              //console.log("error");
              retdict = {"status": "error", "error": "Error"};
              res.send(403, retdict);
            })

        }
        // User from users database now verified and added to verified_users Database
        //console.log("InsertOne DB Connection closed");
})


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
        retdict = {"status":"error", "error": "User not verified or does not exist"};
        res.send(403, retdict);
      }
      else if (result.password !== password) {
        retdict = {"status": "error", "error": "Username and password do not match up."};
        res.send(403, retdict);
      }
      else {
        console.log(result.username);
        console.log("Entry found. Logging in.");

        // If verified, put them in the session

        var token = jwt.sign({username: username}, 'so_clone');
        res.cookie('access_token', token, {secure: false, httpOnly: false});

        console.log("Res headers");
        console.log(res.header()._headers);

        res.status(200).send(retdict);
      }
    });
  }
})

app.post('/logout', (req, res) => {
  console.log("Logout called");
  req.session.username = null;
  res.clearCookie("access_token"); // With cookies, how to change to their equivalent?
  user = null;

  res.json({"status": "OK"});
})

app.get('/questions/add', (req, res) => {
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) res.send(403, "No user logged in right now");
  else {
    res.send("User logged in right now is: " + decoded.username);
  }
})

app.post('/questions/add', (req, res) => {
  // Modify for handling media array
  //console.log("Session details for adding question:");
  //console.log(req);
  //console.log(req.headers);
  //console.log(req.cookies);

  // First, check that a user is logged in
  /*if (req.cookies.username == null) {
    res.send(403, {"status": "error", "error": "No user logged in"});
  }*/
  jwt.verify(req.cookies.access_token, 'so_clone', function(err, decoded) {
    if (err) {
      console.log("No user logged in at add question");
      res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
    }
    else if (decoded.username == null) {
      res.send(403, {"status": "error", "error": "No user logged in"});
    }
    else if (req.body.title == null) {
      res.send(403, {"status": "error", "error": "No title for the question"});
    }
    else if (req.body.body == null) {
      res.send(403, {"status": "error", "error": "The question needs a body"});
    }
    else if (req.body.tags == null) {
      res.send(403, {"status": "error", "error": "The question needs at least one tag"});
    }
    else {
      var username = decoded.username;
      //console.log(username);
      var id = randomstring.generate();
      var retdict = {"status": "OK", "id": null};

      // HOW TO MAKE SURE THEIR REPUTATION IS NOT ALWAYS 1???
      sodb.collection("verified_users").findOne({"username": decoded.username}, function(e1, r1) {
        var u_rep = r1.reputation;
        var add_media = null;
        if (req.body.media != null) {
          console.log("has media");
          // check each item of the media array to ensure that it exists in the Cassandra database, AND that it hasn't been used yet
          var promise = new Promise(function(resolve, reject) {
            console.log("First part of promise");
            resolve("Test");
          })
          promise.then(function(presult1) {
            console.log("Second part of promise");
            var not_error = true;
            for (var i = 0; i < req.body.media.length && not_error; i++) {
              var media_id = req.body.media[i];
              console.log("i = " + i + " and media id is " + media_id);
              sodb.collection("media").findOne({"mid": media_id}).then(function(r2) {
                /*if (e2) {
                  console.log(r2);
                  console.log("Nonexistent media - ERROR");
                  retdict = {"status": "error", "error": "Media file does not exist for this ID - error"}; // file doesn't exist
                  //res.send(403, {"status": "error", "error": "Media file does not exist for this ID"});
                }*/
                if (r2 == null) {
                  console.log("Null r2");
                  retdict = {"status": "error", "error": "Media file does not exist for this ID - error"}; // file doesn't exist
                }
                else if (r2.username != username) {
                  console.log(r2);
                  console.log("Bad username.  Media id " + media_id + " poster " + r2.username + " username " + username);
                  retdict = {"status": "error", "error": "Only the original asker can use their media"};
                  //res.send(403, ); // Ensure file can only be used by original asker
                }
                else if (r2.used) {
                  console.log(r2);
                  console.log("Already used.  Media id " + media_id +r2.username + " username " + username);
                  retdict = {"status": "error", "error": "Media file is already being used in another question/answer"};
                  //res.send(403, ); // file is already used
                }
                else {
                  var new_used_dict = {$set: {used: true}}; // file isn't used and can be used for this question, mark it used
                  console.log("Media with id " + media_id + " exists and is being marked true.");
                  console.log(r2);
                  sodb.collection("media").updateOne({"mid": media_id}, new_used_dict, function(e3, r3) {
                    if (e3) throw e3;
                    else {
                      console.log("Media exists");
                      console.log(r3);
                    }
                  })
                }
              }).then(function (result) {
                if (retdict['status'] == "error") {
                  not_error = false;
                }
              })
            }
            add_media = req.body.media;
            console.log(add_media);
          }).then(function(presult) {
            console.log("Now on to the last part of the promise");
            var obj = {"id": id, "user": {"username": decoded.username, "reputation": u_rep}, "title": req.body.title, "body": req.body.body, "score": 0, "view_count": 1, "answer_count": 0, "timestamp": Date.now() / 1000, "media": add_media, "tags": req.body.tags, "accepted_answer_id": null};
            sodb.collection("questions").insertOne(obj , function(err, result) {
              if (err) {
                console.log("Can't create question");
                retdict = {"status": "error", "error": "Error creating question at this time"};
                //res.send(403, );
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
                sodb.collection("views").insertOne({"id": id, "views": [], "upvotes": [], "downvotes": []}), function(err3, res3) {
                  if (err3) {
                    console.log("err2: " + err2);
                    throw err3;
                  }
                  //else console.log("Views component for this question also created.");
                }
                if (retdict['status'] == "error") {
                  console.log("Sending error status: " + retdict['error']);
                  res.status(403).send(retdict);
                  return;
                }
                else {
                  res.status(200).send({"status":"OK", "id": id});
                  return;
                }
              }
            })
          })
        }
        else {
          var obj = {"id": id, "user": {"username": decoded.username, "reputation": u_rep}, "title": req.body.title, "body": req.body.body, "score": 0, "view_count": 1, "answer_count": 0, "timestamp": Date.now() / 1000, "media": add_media, "tags": req.body.tags, "accepted_answer_id": null};
          sodb.collection("questions").insertOne(obj , function(err, result) {
            if (err) {
              res.send(403, {"status": "error", "error": "Error creating question at this time"});
              return;
            }
            else {
              //console.log("Question successfully inserted into Questions collection");
              sodb.collection("answers").insertOne({"id": id, "answers": []}, function(err2, res2) {
                if (err2) throw err2;
                //else console.log("Counterpart for this question in the answers collection also created.");
              })
              sodb.collection("views").insertOne({"id": id, "views": [], "upvotes": [], "downvotes": []}), function(err3, res3) {
                if (err3) throw err3;
                //else console.log("Views component for this question also created.");
              }
              res.json({"status":"OK", "id": id});
              return;
            }
          })
        }
      })
    }
  })
})

app.get('/questions/:id', (req, res) => {
  var id = req.params.id;
  console.log("ID: " + id);

  sodb.collection("questions").findOne({"id": id}, function(err, result) {
    if (err) {
      console.log("Error");
      res.send(403, {"status": "error", "error": "Error"});
    }
    else if (result == null) {
      console.log("Question not found");
      res.send(403, {"status": "error", "error": "Question not found"});
    }
    else {
      console.log("Question found");
      var new_view_count = result.view_count;

      // Update view Count - if the user is NEW
      // First determine if user is new
      var username;
      if (req.cookies.access_token == null) {
          username = ip.address();
      }
      else {
        var decoded = jwt.verify(req.cookies.access_token, 'so-clone');
        username = decoded.username;
      }
      sodb.collection("views").findOne({"id": id}).then(function(res4) {
        var views = res4.views;
        if (views.indexOf(username) < 0) {
          views.push(username);
          new_view_count = views.length;

          var new_views_dict = {$set: {views: views}};

          sodb.collection("views").updateOne({"id": id}, new_views_dict, function(e5, r5) {
            if (e5) throw e5;
            else console.log("New user, view count incremented");
          })
        }
      }).then(function() {
      var new_view_count_dict = {$set: {view_count: new_view_count}};
      sodb.collection("questions").updateOne({"id": id}, new_view_count_dict, function(err2, res2) {
        if (err2) throw err2;
        else {
          console.log("Question DB updated successfully");
          console.log(result);
          sodb.collection("questions").findOne({"id": id}, function(err3, res3) {
            if (err3) throw err3;
            else {
              console.log("Post update result");
              console.log(res3);
              res.json({"status": "OK", "question": res3});
            }
          })

        }
      })}).catch(function(e5) {
        res.send(403, {"status": "error", "error": "Error e5"});
      }).catch(function(err2) {
        res.send(403, {"status": "error", "error": "Error err2"});
      }).catch(function(err3) {
        res.send(403, {"status": "error", "error": "Error err3"});
      })
    }
  })
})

app.post('/questions/:id/answers/add', (req, res) => {
  console.log("Session for add answer");
  var id = req.params.id;
  console.log(req.session);
  var uname = null;

  // First, check that a user is logged in
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
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
    sodb.collection("answers").findOne({"id": id}, function(err, result) {
      if (err) {
        console.log("Error");
        res.send(403, {"status": "error", "error": "Error"});
      }
      else if (result == null) {
        console.log("Nonexistent question");
        res.send(403, {"status": "error", "error": "A question with this ID does not exist."});
      }
      else {
        var answerid = randomstring.generate();
        var a_media = null;
        if (req.body.media != null) {
          a_media = req.body.media;
        }
        var answerobj = {"id": answerid, "user": uname, "body": req.body.body, "score": 0, "is_accepted": false, "timestamp": Date.now() / 1000, "media": null, "upvotes": [], "downvotes": []};

        var answers_arr = result.answers;
        answers_arr.push(answerobj);
        var new_answer_arr = {$set: {answers: answers_arr}};

        // Update DB Entry
        sodb.collection("answers").updateOne({"id": id}, new_answer_arr, function(err2, res2) {
          if (err2) throw err2;
          else {
            console.log("DB updated successfully");
            res.json({"status": "OK", "id": answerid});
          }
        })

        // Insert into answer list -- works?
        sodb.collection("answer_list").insertOne({"id": answerid, "media": null, "upvotes": [], "downvotes": []}, function(err3, res3) {
          if (err3) throw err3;
          else {
            console.log("Answer added to list");
          }
        })
      }
    })
  }
})

app.get('/questions/:id/answers', (req, res) => {
  var id = req.params.id;

  sodb.collection("answers").findOne({"id": id}, function(err, result) {
    if (err) {
      console.log("Error");
      res.send(403, {"status": "error", "error": "Error"});
    }
    else if (result == null) {
      console.log("Nothing found");
      res.send(403, {"status": "error", "error": "No such question exists with this ID"});
    }
    else {
      console.log(result.answers);

      res.json({"status": "OK", "answers": result.answers});
    }
  })
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
    if (req.body.q.match(/^\s*$/)) {
      console.log("String of ONLY WHITESPACES");
    }
    if (req.body.q != null && req.body.q != "" && !(req.body.q.match(/^\s*$/))) {
      console.log(req.body.q);
      search_q = req.body.q;
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
      console.log("Modifying query");
      query_and_arr.push({"$text": {"$search": search_q}});
      //query = {$and:[{"timestamp": {$lte: timestamp}}, {"$text": {"$search": search_q}}]}; // Add a search query here
      query = {$and: query_and_arr};
    }

    if (has_media) {
      query_and_arr.push({"media":{$ne:null}});
      query = {$and: query_and_arr};
    }

    if (accepted) {
      query_and_arr.push({"accepted_answer_id": {$ne: null}});
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
          console.log("Search results:");
          console.log(result);

          res.json({"status": "OK", "questions": result});
        }
        else {
          console.log("Error");
          res.send(403, {"status": "error", "error": "Error"});
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
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
  else if (decoded.username == null) {
    res.send(403,"You do not have rights to do this!");
  }
  else {
    var id = req.params.id;

    sodb.collection("questions").findOne({id: id}, function(err, result) {
      if (err) throw err;
      if (result.user['username'] != decoded.username) {
        res.send(403,"You do not have rights to do this!");
        //res.json({"status": "error", "error": "Only the author can delete their question"});
      }
      else {
        sodb.collection("questions").deleteOne({id: id}, function(err, result) {
          if (err) throw err;
          console.log("1 question document deleted");

          // Rough draft for deleting answers and media
          sodb.collection("answers").deleteOne({id: id}, function(err2, res2) {
            if (err2) throw err2;
            console.log("1 answers document deleted");
          })

          res.json({"status": "OK"});
        });
      }
    });
  }
})

app.get('/user/:username', (req, res) => {
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
  else if (decoded.username == null) {
    res.send(403, {"status": "error", "error": "No username given"});
  }
  var username = decoded.username;

  sodb.collection("verified_users").findOne({username: username}, function(err, result) {
    if (err) {
      res.send(403, {"status": "error", "error": "total error"});
    }
    else if (result == null) {
      res.send(403, {"status": "error", "error": "User does not exist"});
    }
    else {
      console.log("user found");

      // Obtain the user details
      var email = result.email;
      var rep = result.reputation;

      // Return the user details
      res.json({"status": "OK", "user": {"email": email, "reputation": rep}});
    }
  })
})

app.get('/user/:username/questions', (req, res) => {
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) {
    res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
    return;
  }
  var username = decoded.username;
  console.log("Username is " + username);
  // Find all questions where user['username'] is the given username

  sodb.collection("questions").find({"user.username": username}).toArray(function (err, result) {
    if (err) throw err;

    // return the array of Question ID's - iterate through result
    var q_id_arr = [];

    result.forEach(e => {
      q_id_arr.push(e.id);
    })

    console.log(result);
    console.log(q_id_arr);

    res.json({"status": "OK", "questions": q_id_arr});
  })
})

app.get('/user/:username/answers', (req, res) => {
  var decoded = jwt.verify(req.cookies.access_token, 'so_clone');
  if (decoded == null) {
    res.send(403, {"status": "error", "error": "Error: No user logged in or no token found"});
    return;
  }
  var username = decoded.username;
  // Find all answers where user['username'] is the given username

  var sorter = {"timestamp": -1}
  sodb.collection("answers").find().sort(sorter).toArray(function (err, result) {
    if (err) throw err;

    // return the array of Question ID's
    var a_id_arr = [];

    console.log(result);

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
app.post("/questions/:id/upvote", (req, res) => {
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
  // Make sure the question exists
  sodb.collection("questions").findOne({"id": id}, function (err, result) {
    if (err) throw err;
    else {
      q_username = result.user.username;
    }
  })

  sodb.collection("views").findOne({"id": id}, function(err, result) {
    var upvotes = result.upvotes;
    var downvotes = result.downvotes;
    var vote = true; // True if upvote, false if downvote

    // Handle case where user has not viewed the question yet
    /*if (result.views.indexOf(username) < 0) {
      res.json({"status": "error", "error": "User has not viewed the question yet"});
      return;
    }*/

    if (req.body.upvote != null) {
      vote = req.body.upvote;
    }

    if (vote == true) {
      // First, make sure the person isn't upvoting twice
      if (upvotes.indexOf(username) >= 0) {
        console.log("User has already upvoted.  Undoing upvote.");
        upvotes.splice(upvotes.indexOf(username), 1);

        var new_score = upvotes.length - downvotes.length;

        var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};

        sodb.collection("views").updateOne({'id': id}, new_views_dict, function(e5, r5) {
          if (e5) throw e5;

          else console.log("Votes updated - DOWNVOTE");
        })

        sodb.collection("questions").updateOne({"id": id}, {$set: {"score": new_score}}, function(e6, r6) {
          if (e6) throw e6;
          else console.log("Question reputation updated - DOWNVOTE");
        })

        sodb.collection("verified_users").findOne({"username": q_username}, function(e7, r7) {
          if (e7) throw e7;

          var old_rep = r7.reputation;
          if (old_rep > 1) {
            sodb.collection("verified_users").updateOne({"username": q_username}, {$set: {"reputation": old_rep - 1}}, function(e8, r8) {
              if (e8) throw e8;
              console.log("User reputation updated - DOWNVOTE");
            })
          }
          else {
            console.log("Can't downvote user's reputation further");
          }
        })

        res.json({"status": "OK"});
        return;
      }
      else if (downvotes.indexOf(username) >= 0) { // case if user is in the downvotes array
        downvotes.splice(downvotes.indexOf(username), 1);
      }
      console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length);

      upvotes.push(username);

      var new_score = upvotes.length - downvotes.length;
      console.log("New reputation: " + new_score);

      var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};

      sodb.collection("views").updateOne({'id': id}, new_views_dict, function(e2, r2) {
        if (e2) throw e2;

        else console.log("Votes updated - UPVOTE");
      })

      sodb.collection("questions").updateOne({"id": id}, {$set: {"score": new_score}}, function(e3, r3) {
        if (e3) throw e3;
        else console.log("Question reputation updated - UPVOTE");
      })

      sodb.collection("verified_users").findOne({"username": q_username}, function(e7, r7) {
        if (e7) throw e7;

        var old_rep = r7.reputation;
        sodb.collection("verified_users").updateOne({"username": q_username}, {$set: {"reputation": old_rep + 1}}, function(e8, r8) {
          if (e8) throw e8;
          console.log("User reputation updated - DOWNVOTE");
        })
      })

      res.json({"status": "OK"});
    }
    else {
      // We need to get the reputation first, to ensure it won't go below the minimum of 1
      sodb.collection("questions").findOne({"id": id}, function(e4, r4) {
        if (e4) throw e4;
        /*else if (r4.reputation - 1 < 1) {
          console.log("Question must have a minimum reputation of 1 (subtract 1)");
          res.json({"status": "error", "error": "Question must have a minimum reputation of 1 (subtract 1)"});
          return;
        }*/
        else {
          //var q_username = r4.user.username;
          if (downvotes.indexOf(username) >= 0) {
            console.log("Cannot downvote twice.  Undoing downvote.");

            downvotes.splice(downvotes.indexOf(username), 1);

            var new_score = upvotes.length - downvotes.length;

            var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};

            sodb.collection("views").updateOne({'id': id}, new_views_dict, function(e5, r5) {
              if (e5) throw e5;

              else console.log("Votes updated - DOWNVOTE");
            })

            sodb.collection("questions").updateOne({"id": id}, {$set: {"reputation": new_score}}, function(e6, r6) {
              if (e6) throw e6;
              else console.log("Question reputation updated - DOWNVOTE");
            })

            sodb.collection("verified_users").findOne({"username": q_username}, function(e7, r7) {
              if (e7) throw e7;

              var old_rep = r7.reputation;
              sodb.collection("verified_users").updateOne({"username": q_username}, {$set: {"reputation": old_rep + 1}}, function(e8, r8) {
                if (e8) throw e8;
                console.log("User reputation updated - DOWNVOTE");
              })
            })

            res.json({"status": "OK"});
            return;
          }
          else if (upvotes.indexOf(username) >= 0) {
            upvotes.splice(upvotes.indexOf(username));
            /*if (r4.reputation - 2 < 1) {
              console.log("Question must have a minimum reputation of 1 (subtract 2)");
              res.json({"status": "error", "error": "Question must have a minimum reputation of 1 (subtract 2)"});
              return;
            }
            else {
              upvotes.splice(upvotes.indexOf(username));
            }*/
          }

          downvotes.push(username);

          var new_score = upvotes.length - downvotes.length;

          var new_views_dict = {$set: {"upvotes": upvotes, "downvotes": downvotes}};

          sodb.collection("views").updateOne({'id': id}, new_views_dict, function(e5, r5) {
            if (e5) throw e5;

            else console.log("Votes updated - DOWNVOTE");
          })

          sodb.collection("questions").updateOne({"id": id}, {$set: {"reputation": new_score}}, function(e6, r6) {
            if (e6) throw e6;
            else console.log("Question reputation updated - DOWNVOTE");
          })

          sodb.collection("verified_users").findOne({"username": q_username}, function(e7, r7) {
            if (e7) throw e7;

            var old_rep = r7.reputation;
            if (old_rep > 1) {
              sodb.collection("verified_users").updateOne({"username": q_username}, {$set: {"reputation": old_rep - 1}}, function(e8, r8) {
                if (e8) throw e8;
                console.log("User reputation updated - DOWNVOTE");
              })
            }
            else {
              console.log("Can't downvote user's reputation further");
            }
          })

          res.json({"status": "OK"});
        }
      })
    }
  })
})

app.post("/answers/:id/upvote", (req, res) => {
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
  if (req.body.vote != null) {
    vote = req.body.vote;
  }

  sodb.collection("answers").findOne({"answers.id": id}, {"answers": {$elemMatch: {"id": id}}}, function(err, result) {
    if (err) throw err;
    console.log(result);
    console.log("End of answers result");

    var answer = result.answers.find(x => x.id === id); // if not compatible, maybe use lodash here?
    console.log(answer);

    // given our answer, now upvote/downvote it, and change score accordingly
    var score = answer.score;
    var upvotes = answer.upvotes;
    var downvotes = answer.downvotes;
    // How to update the answer dictionary, then update the array, then update the answers entry with the new array?

    var a_username = answer.user;

    if (vote == true) { // upvote answer or undo upvote
      // First, make sure the person isn't upvoting twice
      if (upvotes.indexOf(username) >= 0) {
        console.log("User has already upvoted answer.  Undoing upvote for ANSWER.");
        upvotes.splice(upvotes.indexOf(username), 1);
        var new_ans_score = upvotes.length - downvotes.length;

        answer.upvotes = upvotes;
        answer.downvotes = downvotes;
        answer.score = new_ans_score;

        sodb.collection("verified_users").findOne({"username": a_username}, function(e7, r7) {
          if (e7) throw e7;

          var old_rep = r7.reputation;
          if (old_rep > 1) {
            sodb.collection("verified_users").updateOne({"username": a_username}, {$set: {"reputation": old_rep - 1}}, function(e8, r8) {
              if (e8) throw e8;
              console.log("User reputation updated - DOWNVOTE");
            })
          }
          else {
            console.log("Can't downvote user's reputation further");
          }
        })

        res.json({"status": "OK"});
        return;
      }
      else if (downvotes.indexOf(username) >= 0) { // case if user is in the downvotes array
        downvotes.splice(downvotes.indexOf(username), 1);
      }
      console.log("Upvotes: " + upvotes.length + " Downvotes: " + downvotes.length);

      upvotes.push(username);

      answer.upvotes = upvotes;
      answer.downvotes = downvotes;
      var new_ans_score = upvotes.length - downvotes.length;
      console.log("New answer reputation: " + new_ans_score);
      answer.score = new_ans_score;

      // How to update the answer dictionary, then update the array, then update the answers entry with the new array?
      var answerUpdateIndex = result.answers.findIndex(x => x.id === id);
      if (answerUpdateIndex >= 0) {
        result.answers[answerUpdateIndex] = answer;

        sodb.collection("answers").updateOne({"answers.id": id}, {$set: {"answers" : result.answers}}, function(e9, r9) {
          if (e9) throw e9;
          else {
            console.log("Answers array updated ... hopefully");
          }
        })
      }

      sodb.collection("verified_users").findOne({"username": a_username}, function(e7, r7) {
        if (e7) throw e7;

        var old_rep = r7.reputation;
        sodb.collection("verified_users").updateOne({"username": a_username}, {$set: {"reputation": old_rep + 1}}, function(e8, r8) {
          if (e8) throw e8;
          console.log("User reputation updated from ANSWER - DOWNVOTE");
        })
      })

      res.json({"status": "OK"});
    }
    else { // downvote answer or undo downvote
      if (downvotes.indexOf(username) >= 0) {
        console.log("Cannot downvote twice.  Undoing downvote.");

        downvotes.splice(downvotes.indexOf(username), 1);

        var new_score = upvotes.length - downvotes.length;

        answer.upvotes = upvotes;
        answer.downvotes = downvotes;
        answer.score = new_score;

        // How to update the answer dictionary, then update the array, then update the answers entry with the new array?
        var answerUpdateIndex = result.answers.findIndex(x => x.id === id);
        if (answerUpdateIndex >= 0) {
          result.answers[answerUpdateIndex] = answer;

          sodb.collection("answers").updateOne({"answers.id": id}, {$set: {"answers" : result.answers}}, function(e9, r9) {
            if (e9) throw e9;
            else {
              console.log("Answers array updated ... hopefully");
            }
          })
        }

        sodb.collection("verified_users").findOne({"username": a_username}, function(e7, r7) {
          if (e7) throw e7;

          var old_rep = r7.reputation;
          sodb.collection("verified_users").updateOne({"username": a_username}, {$set: {"reputation": old_rep + 1}}, function(e8, r8) {
            if (e8) throw e8;
            console.log("User reputation updated - DOWNVOTE");
          })
        })

        res.json({"status": "OK"});
        return;
      }
      else if (upvotes.indexOf(username) >= 0) {
        upvotes.splice(upvotes.indexOf(username));
      }

      downvotes.push(username);

      var new_score = upvotes.length - downvotes.length;
      answer.score = new_score;
      answer.upvotes = upvotes;
      answer.downvotes = downvotes;

      // How to update the answer dictionary, then update the array, then update the answers entry with the new array?
      var answerUpdateIndex = result.answers.findIndex(x => x.id === id);
      if (answerUpdateIndex >= 0) {
        result.answers[answerUpdateIndex] = answer;

        sodb.collection("answers").updateOne({"answers.id": id}, {$set: {"answers" : result.answers}}, function(e9, r9) {
          if (e9) throw e9;
          else {
            console.log("Answers array updated ... hopefully");
          }
        })
      }

      sodb.collection("verified_users").findOne({"username": a_username}, function(e7, r7) {
        if (e7) throw e7;

        var old_rep = r7.reputation;
        if (old_rep > 1) {
          sodb.collection("verified_users").updateOne({"username": a_username}, {$set: {"reputation": old_rep - 1}}, function(e8, r8) {
            if (e8) throw e8;
            console.log("User reputation updated - DOWNVOTE");
          })
        }
        else {
          console.log("Can't downvote user's reputation further");
        }
      })

      res.json({"status": "OK"});
    }
  })
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
    console.log("No user logged in");
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
              console.log("Answer accepted!");
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
  console.log("add media");
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
        console.log("Hopeful blob content being added");
        console.log(content);
        console.log(err2); // if no error, undefined
        console.log("Inserted into Cluster?");
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
  console.log("Media id: " + id);

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
      console.log("Executing retrieve");
      //res.contentType(req.query.filename.split(".")[1]);
      console.log("Media result");
      console.log(result);

		  res.send(200, result.rows[0].content);
    }
  });
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
