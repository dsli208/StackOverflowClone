const express = require('express')
const app = express()

app.use(express.urlencoded());
app.use(express.json());

var cassandra = require('cassandra-driver');

const client = new cassandra.Client({
  contactPoints: ['192.168.122.19'],
  localDataCenter: 'datacenter1',
  keyspace: 'test'
});

const query = 'INSERT INTO testtable (stuff1, stuff2) VALUES (?, ?)';
const params = ["abc", "def"];
client.execute(query, params, { prepare: true }, function (err) {
      console.log("Hopeful blob content being added");
      console.log(err); // if no error, undefined
      console.log("Inserted into Cluster?");
});
