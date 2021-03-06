define(function(){

	var LoginHandler = function(http, db){

		var url = require('url');

		http.createServer(function(req, res){

			var request = url.parse(req.url, true).query; // request from user

			res.writeHead(200, {'Content-Type': 'text/json', 'Access-Control-Allow-Origin' : '*'}); // FIXME: shouldn't need to do this

            console.log(util.inspect(request));

			var reply = null;
			if (!('request' in request)) {
				reply = {success:false, reason:'No request'};
			} else {
				if (request.request == REQ_REGISTER) {

					console.log("User attempting to register..");
					var username = request.username,
						password = request.password,
                        email    = request.email,
                        spawn    = null;

                    if (Env.isTest) {
                        spawn = {
                            spawnArea: request.spawnArea,
                            spawnPosition: request.spawnPosition
                        };
                    }


					// Validation
					var err = null;
					var filteredUsername = Env.login.filterUsername.exec(username);
					if (!_.isString(username) || !_.isArray(filteredUsername) || filteredUsername.length != 1 || filteredUsername[0] != username) {
						err = "Bad username";
					}

					var filteredPassword = Env.login.filterPassword.exec(password);
					if (!_.isString(password) || !_.isArray(filteredPassword) || filteredPassword.length != 1 || filteredPassword[0] != password) {
						err = "Bad password";
					}

					var filteredEmail = Env.login.filterEmail.exec(email);
					if (!_.isString(email) || !_.isArray(filteredEmail) || filteredEmail.length != 1 || filteredEmail[0] != email) {
						err = "Bad email";
					}

					if (err) {
						reply = {success:false, reason: err};
						res.end(JSON.stringify(reply));
					} else {
						db.registerUser(username, password, email, spawn).then(function(err, id){
							
							if (err) {
								reply = {success:false, reason: err};
							} else {
								reply = {success:true, id:id};
							}

							res.end(JSON.stringify(reply));
						}, function(err){
							console.error(err);
							reply = {success:false, reason:'Error on server'};
							res.end(JSON.stringify(reply));
						}).catch(Error, function(err){
							console.error(err);
							reply = {success:false, reason:'Error on server'};
							res.end(JSON.stringify(reply));
						});
					}
				}
			}


		}).listen(8124);

	};

	return LoginHandler;
});
