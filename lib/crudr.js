var fs = require("fs"), 
	path = require("path"),
	//crypto = require('crypto'), 
	_ = require("underscore"),
	config = require('../config/default'),
	
	Sockets = require('./sockets'),
	Routes = require('./routes'),
	Backend = require('./backend'); 


var CRUDr = function (){ 
	
	var self = this;
	
	// load helper files
	this.helpers = {}; 
	
	fs.readdirSync(path.dirname(__dirname) + '/helpers').forEach(function(filename) {
		// stop if this is not a js file 
		if(filename.substr(-3) == ".js"){
			var name = path.basename(filename, '.js');
			self.helpers.__defineGetter__(name, function() {
				return require('../helpers/' + name);
			});
		}
	});
	
}
	
CRUDr.prototype = {
	
	options : {
			config : config,
			app : {},
			db : {}, 
			sync : false, 
			auth : false
	}, 
	
	sockets : new Sockets(), 
	routes : new Routes(), 
	
	listen : function(options) {
		// support for express 2.x
		if ( typeof options.server == "undefined" ) options.server = options.app;
		// #23 FIX: extend default config with the existing config (recursive)
		for( i in config){
			if(typeof options.config[i] == "undefined") {
				options.config[i] =  config[i];
			} else {
				options.config[i] = ( config[i] instanceof Object ) ? _.extend( config[i], options.config[i]) : options.config[i];
			}
		}
		
		// extend defaults with the existing options
		this.options = _.extend( this.options, options);
		// initialize the backend
		options.db = this.backends( this.options ); 
		
		// (need this?) save options as objects for future reference 
		for( i in options){
			this[i] = options[i];
		}
		
		// setup routes if express is available
		if( !_.isEmpty( this.app) )
			this.routes.init( this.app, this.db, this.config );
		
		//  setup sockets if  server is available
		if( !_.isEmpty( this.server) )
			this.sockets.init( this.options );
		
		
		// return the io object in case the dev needs to make further setup
		return this.sockets.io;
	}, 
	// connects db objects with backend helpers
	backends : function( options ) {
		var backends = ( options.config ) ? options.config.backends : ( options.backends || false );
		var stores = {};
		// if there are no backends, exit now...
		if( !backends ) return stores;
		
		// loop through the backends
		for(var i in backends ){ 
			var name = backends[i];
			
			var backend = new Backend();
			// see if there's a db specifically for the backend (or return the whole object)
			var db = options.db[i] || options.db; 
			var sync = (options.sync) ? (options.sync[i] || false) : false;
			
			backend.use({ middleware: this.helpers[name]( db ), sync: sync });
			
			// Proxy events on the backend back to the app
			/*var events = { 'created': 'create', 'updated': 'update', 'deleted': 'delete' };
			Object.keys(events).forEach(function(event) {
				backend.on(event, function(model) {
					console.log( events[event]);
				});
			});*/
			
			stores[i] = backend;
			
		}
		
		return stores;
	}, 
	// include dbs / backends 
	add: function ( options ) {
		//console.log( "----- add ------");
		var db = options.db || false;
		var backends = options.backends || false;
		// stop if there's no db or backend
		if( !db || !backends ) return;
		// create new backends
		var dbs = this.backends( options );
		// extend the existing db object
		this.db = _.extend( this.db, dbs);
		// update routes
		this.routes.add( dbs );
		// update sockets
		this.sockets.add( dbs );
		
	}, 
	// update an existing backend
	update : function( options ){
		//console.log( "----- update ------");
		var db = options.db || false;
		var backends = options.backends || false;
		// stop if there's no db or backend
		if( !db || !backends ) return;
		// create new backends
		var dbs = this.backends( options );
		// extend the existing db object (replacing the old dbs)
		this.db = _.extend( this.db, dbs);
		// update routes
		this.routes.update( dbs );
		// update sockets
		this.sockets.update( dbs );
		
	}, 
	// remove a backend
	remove: function ( options ) {
		//console.log( "----- remove ------");
		var db = options.db || false;
		var backends = options.backends || false;
		// stop if there's no db or backend
		if( !db || !backends ) return;
		// create new backends
		var dbs = this.backends( options );
		// update routes
		this.routes.remove( dbs );
		// update sockets
		this.sockets.remove( dbs );
		
	}


}


var crudr = new CRUDr();

module.exports = crudr;