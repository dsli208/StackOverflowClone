const express = require('express')
const app = express()
const port = 3000;

const ip = require('ip');

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
// public "floating" ip 130.245.169.172, private ip 192.168.122.18

var url = "mongodb://192.168.122.18:27017/";
var mongodb;
var remotedb;
var grid;

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  // Create database
  mongodb = db;
  remotedb = mongodb.db("testremote");
  console.log("Database created!");

  var myobj = { name: "Company Inc", address: "Highway 37" };
  remotedb.collection("customers").insertOne(myobj, function(err, res) {
    if (err) throw err;
    console.log("1 document inserted");
  });

});
