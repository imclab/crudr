var express = require("express"),
	crudr = require("crudr"), // Include CRUDr lib
	http = require("http"); 
	
var app = express();
var server = http.createServer(app);

// override default config
var config = {
  "backends" : {
      "test" : "memoryStore"
  }
}

// setup options
var options = {
    config: config,
    app: app, 
    server: server
};

// initialize CRUDr
crudr.listen(options);

// map static folder
app.use(express.static(__dirname + '/public'));

server.listen(80);