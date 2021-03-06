// Globals
var crudr, socket;

(function() {
    
	CRUDr = function (){ 
		
		//this.url = window.location.protocol + "://" + window.location.host + "/" + window.location.pathname
		this.init();
		
		return this;
	}
	
	CRUDr.prototype = {
		state : {
			auth : false,
			deps: false,
			socket: false
		},
		// defaults
		options : {
			log : false, 
			auth : true, 
			key : false,
			secret : false
		}, 
		init : function(){
			var self = this;
			this.token = false;
			
			this.promise = new Promise();
			//this.promise.add( this.sockets );
			
			// this does nothing??
			this.status("initialized");
			
		}, 
		connect: function( options, callback){ 
			var self = this;
			// fallback
			options || (options = {});
			// merge with defaults
			for( var i in options ){
				this.options[i] = options[i];
			}
			this.redirect_uri = window.location;
			// add the (original) calback in the promise list
			if( typeof callback != "undefined" ) {
				this.promise.add( callback );
			}
			
			// set auth state
			if( typeof options.auth == "undefined" ) options.auth = true;
			
			// If key is provided expect a valid confirmation from the callback
			// unless auth=false, then the key is disegarded...
			if( typeof options.key != "undefined" &&  options.auth ) {
				
				// get the token...
				var cookie = Cookie.get("crudr_token");
				
				// if (window.location.hash.length == 0) {
				//if( typeof( cookie ) == "undefined" && typeof( token ) == "undefined" ){ 
				if( typeof( cookie ) == "undefined" ){ 
					
					var path = '{{host}}/{{authorize}}';
					var params = [];
					// conidtion the use of the following params
					if( options.key ) params.push( 'client_id=' + options.key );
					if( options.secret ) params.push( 'client_secret=' + options.secret );
					// always add a redirect uri and the response type
					//params.push( 'redirect_uri=' + this.redirect_uri );
					params.push( 'response_type=token' );
					
					var url = path + "?" + params.join('&');
					
					//window.location= url;
					ajax( url, function( res ){ self.auth( res ); } );
					
				
				} else {
					// continue with the cookie we already have...
					this.token = cookie;
					this.status("authenticated");
					
				}
			} else {
				
				// skip authentication...  
				this.status("authenticated");
				
			}
			
			
			
		}, 
		sync : function(socket, req, callbacks) {
			var self = this;
			// check if this.status is initialized first...
			socket.emit('sync', req, function(err, resp) {
				var log = self.options.log;
				if (err) {
					callbacks.error(err);
					if( log ) self.log( err );
				} else {
					//make sure the response is a JSON;
					var data = (typeof resp != "object") ? JSON.parse(resp) : resp;
					// fallback for null data
					if( data == null ) data = [];
					callbacks.success(data);
					if( log ) self.log( data );
				}
			});
		}, 
		status : function( flag ){
			
			switch( flag ){
				case "authenticated":
					this.state.auth = true;
				break;
				case "failed":
					this.state.auth = false;
				break;
				case "loaded":
					this.state.deps = true;
				break;
				case "connected":
					this.state.socket = true;
				break;
				case "disconnected":
					this.state.socket = false;
				break;
			};
			
			// log the event...
			var log = this.options.log;
			if( log ) this.log(flag);
			
			// check if the right flags are in place
			if( this.state.auth && this.state.deps ) {
				// load the sockets 
				this.sockets();
			}
			
			if( this.state.socket ) {
				// load the callback 
				this.promise.resolve();
			}
		}
		
	}
 
    CRUDr.prototype.subscribe = function(options) {
        //
		options = options || {};
		var self = this;
		var name = options.name || false;
        var el = options.el || false;
        var log = this.options.log;
		
		var promise = new Promise( el );
        
		var backend = {
            name: name,
            socket: socket.of(name),
            options: null,
            ready: promise.add
        };
        
		backend.socket.emit('listen', function(options) {
            backend.options = options; 
            backend.socket.on('synced', function(method, resp) {
                var event = backend.options.event;
				
				// create standard events for "dumb" objects
				if(typeof el.trigger == "undefined"){
					// fallback to a regular event dispatcher
					var evt = document.createEvent("Events");
					evt.initEvent(event,true,true); 
					evt.method = method; 
					evt.response = resp; 
					el.dispatchEvent(evt);

            		var evt = document.createEvent("Events");
					evt.initEvent(event + ':' + method,true,true); 
					evt.response = resp; 
					el.dispatchEvent(evt);

				} else {
					el.trigger(event, method, resp);
                	el.trigger(event + ':' + method, resp);
				}
				// log event
				if( log ) self.log( resp );
            });
            
            promise.resolve();
        });
        
					
        return backend;
    };
	
	
	CRUDr.prototype.auth = function( response ){
		// settings
		var log = this.options.log;
		
		try{ 
		
			if( response.error ){
				this.status("failed");
				if( log ) this.log(response.message);
			} else {
				var token = response["access_token"];			
				var expiry = response["expires_in"];
				// console.log access token? 
				// 
				// save token in cookie... 
				Cookie.set("crudr_token", token, expiry);
				this.token = token;
				// in any case set the state of the object to: 
				this.status("authenticated");
				
			}
		} catch( e ) {
			// there was an exception in processing the request - output a default message (for now) 
			console.log("There was an unexpected error loading CRUDr. Please send a report to: http://crudr.com/support"); 
		}
		
		/* else {
			this.state("connected");
		}
		*/
		
	};
	
	CRUDr.prototype.sockets = function(){
		var self = this;
		
		// initiate handshake 
		socket = io.connect('{{host}}');
		
		// main sockets switch
		socket.on('connect', function(){ 
			
			socket.emit('token', self.token);
			socket.on('ready', function () {
				self.status("connected");	
			});
		});
		
		socket.on('disconnect', function(){ 
			
			self.status("disconnected");
				
		});
		
	};
			
	// Based on the Paul Irish's log(): http://paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
	CRUDr.prototype.log = function(){
		this.history = this.history || [];   // store logs to an array for reference
		this.history.push(arguments);
		if(window.console){
			console.log( Array.prototype.slice.call(arguments) );
		}
	};
	

// Helpers (not available in the global namespace) 
// - grouping callbacks
function Promise (obj) {
	var args = null;
	var callbacks = [];
	var resolved = false;
	
	this.add = function(callback) {
		if (resolved) {
			callback.apply(obj, args);
		} else {
			callbacks.push(callback);
		}
	},
	
	this.resolve = function() {
		if (!resolved) {            
			args = arguments;
			resolved = true;
			
			var callback;
			while (callback = callbacks.shift()) {
				callback.apply(obj, arguments);
			}
			
			callbacks = null;
		}
	}
};
    

// - create an ajax request
function ajax( url, callback ){
				
	var req = new XMLHttpRequest();
	var self = this;
	
	req.open("GET",url,true);
	req.send(null);
	req.onerror = function(){
		console.log("there was an error with your request");
	};
	req.onload = function(e){
		var response = JSON.parse(e.target.responseText);
		callback.call(self, response);
	}
				
}

// - cookies...
var Cookie = {
	get : function(name) {
		var i,key,value,cookies=document.cookie.split(";");
		for (i=0;i<cookies.length;i++){
			key=cookies[i].substr(0,cookies[i].indexOf("="));
			value=cookies[i].substr(cookies[i].indexOf("=")+1);
			key=key.replace(/^\s+|\s+$/g,"");
			if (key==name){
				return unescape(value);
			}
		}
	}, 
	
	set : function(name,val,expiry){
		var date = new Date( ( new Date() ).getTime() + parseInt(expiry) );
		var value=escape(val) + ((expiry==null) ? "" : "; expires="+date.toUTCString());
		document.cookie=name + "=" + value;
	}, 
	
	check : function( name ){
		var cookie=this.get( name );
		if (cookie!=null && cookie!=""){
			return true;
		} else {
			return false;
		}
	}
	
};

// lookup query params
function query(name) {
	var query = window.location.search.substring(1);
	var vars = query.split("&");
	for (i=0; i < vars.length; i++) {
		var target = vars[i].split("=");
		if (target[0] == name) {
			return target[1];
		}
	}
}

	
// create a new instance of the lib in the global namespace
this.crudr = new CRUDr();

}).call(this);

// load dependencies
// - the socket.io lib
// #43 Optionally loading socket.io client
if(typeof io !== "undefined"){ 
	// sockets already loaded...
	crudr.status("loaded");
} else { 
	// first check if there is a module loader
	if (typeof define === "function" && define.amd) {
		define(["{{host}}/socket.io/socket.io.js"], function(){ crudr.status("loaded") });
	} else {
	// load the script with a new tag
		(function() {
			var po = document.createElement('script'); po.type = 'text/javascript'; po.async = false;
			po.src = '{{host}}/socket.io/socket.io.js';
			po.onreadystatechange = po.onload = function(){ crudr.status("loaded") };
			var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s);
		})();	
	}
}