define(['loggable'], function(Loggable){

	var DB = function(){
		extendClass(this).with(Loggable);
		this.setLogGroup('DB');
		this.setLogPrefix('(DB) ');

		var mongo = null,
			db    = null;

		var crypto = require('crypto');

		this.connect = function(){

			var me = this;
			return new Promise(function(loaded, failed) {

				// Setup our mongo connection
				mongo = require('mongodb').MongoClient;
				mongo.connect('mongodb://127.0.0.1:27017/myquest', function(err, _db){
					db = _db;
					if (err) {
						this.Log("Failed to connect", LOG_ERROR);
						this.Log(err, LOG_ERROR);
						failed(err);
					}

					this.Log("Connected and ready to go");
					loaded();
				});

			});
		};
		

		this.disconnect = function(){
			db.close();
		};


		this.loginPlayer = function(username, password){

			return new Promise((function(resolved, failed){

				if (!_.isString(username) || !_.isString(password)) {
					failed('Invalid username/password');
					return;
				}

				var shasum = crypto.createHash('sha1');
				shasum.update('SALTY'+password);

				db
				.collection('players')
				.findOne({'$and':[{username:username}, {password: shasum.digest('hex')}]}, (function(err, player) {

					if (err || !player) {
						this.Log("Could not find player ("+username+")");
						failed("Bad username/password");
					}  else {
						this.Log("Found player ("+username+")");
						this.Log(player);
						resolved(player);
					}
				}).bind(this));


			}).bind(this));
		};


		this.registerUser = function(username, password, email){
			return new Promise(function(finished, failed){

				db
				.collection('players')
				.findOne({username:username}, function(err, player){

					// Player already exists?
					if (err) {
						this.Log("Error finding player");
						this.Log(username);
						finished(err);
					} else if (player) {
						finished('Player already exists');
						return;
					}

					console.log("No player ("+username+") found..creating new user");
					var shasum = crypto.createHash('sha1');
					shasum.update('SALTY'+password);

					// No player exists with these credentials.. register new user
					this.createNewPlayer({map:'main', position:{y:60, x:53}}, username, shasum.digest('hex'), email).then(function(newID){
						finished(null, newID);
					}, function(err){
						failed(err);
					}).catch(Error, function(err){
						console.error(err);
						failed(err);
					});

				}.bind(this));
			}.bind(this));
		};


		// Attempt to create a new player in the db
		this.createNewPlayer = function(playerAttributes, username, password, email){

			return new Promise((function(succeeded, failed){
				db
				.collection('players')
				.find({}, {sort:{'id':-1}, limit:1}).toArray((function(err, res){
					if (err) {
						this.Log("Error retrieving player ID's", LOG_ERROR);
						this.Log(err, LOG_ERROR);
					} else {
						var id;
						if (res.length) {
							var maxID = res[0].id;
							id = maxID + 1;
						} else {
							id = 1;
						}
						if (isNaN(id)) {
							this.Log("Bad id ("+id+") retrieved..", LOG_ERROR);
							failed();
						}


						// TODO: check if this works for certain cases (eg.  player.position.x=20 (but not
						// setting defaults.position.y) will this still set default position.y but replace
						// position.x?)
						var player = _.defaults(playerAttributes, {
							// Default player values
							id: id,
							username: username,
							password: password,
							email: email,
							position: {
								y: 60, x: 53
							},
							respawn: {
								map: "main",
								position: {
									y: 60, x: 53
								},
							},
							map: "main"
						});

						db
						.collection('players')
						.insert([ player ], (function(err, res){
							this.Log("Created new character ["+id+"] for user..");
							succeeded( id );
						}).bind(this));
					}
				}).bind(this));

			}).bind(this));
		};

		this.savePlayer = function(player){

		   var y     = Math.round((player.position.local.y + player.page.y*Env.tileSize)/Env.tileSize),
			   x     = Math.round((player.position.local.x + player.page.x*Env.tileSize)/Env.tileSize),
			   mapID = player.page.map.id;

			db
			.collection('players')
			.update({id:player.playerID}, {"$set": {position:{y:y,x:x}, map:mapID}}, function(err){
				if (err) Log(err, LOG_ERROR);
				Log("Successfully updated player ("+player.playerID+") position.. ("+y+","+x+") in map("+mapID+")");
			});
		};

	};

	return DB;
});
