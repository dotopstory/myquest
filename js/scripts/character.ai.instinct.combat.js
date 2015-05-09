define(['SCRIPTENV', 'scripts/character', 'scripts/character.ai.instinct', 'eventful', 'hookable', 'dynamic', 'loggable'], function(SCRIPTENV, Character, Instinct, Eventful, Hookable, Dynamic, Loggable){
	
	eval(SCRIPTENV);

	var Combat = function(game, brain){
		extendClass(this).with(Eventful);
		extendClass(this).with(Hookable);
		extendClass(this).with(Dynamic);
		extendClass(this).with(Loggable);
		this.setLogGroup('Instinct');
		this.setLogPrefix('(Combat:'+ brain.character.entity.id +') ');

		this.base = Instinct;
		this.base();

		this.name = "combat";

		var _combat    = this,
			brain      = brain,
			_game      = game,
			_character = brain.character,
			_script    = null;

		this.target    = null;

		// The time since we last hit something. This is set as now by default to avoid having to check in
		// every routine when considering the delta.
		//
		// NOTE: we may need to consider splitting this into multiple elements as well as a base element.
		// It'd probably be better to place a timeSinceLastAttack in each ability; but to keep this here for a
		// base time (ie. not able to melee attack and then cast a spell immediately afterwards)
		this.timeSinceLastAttack = now(); 
		this.attackBusy = false; // Are we currently attempting to attack? timeSinceLastAttack will not have updated yet

		this.addMelee = function(){

			var meleeState = this.addState('melee'),
				chaseState = this.addState('chasing'),
				waiting    = this.addState('waiting');

			meleeState.onEnter = function(target){
				console.log("Entered melee state");

				if (!(target instanceof Character)) return new Error("Target is not a character");
				if (target.isPlayer && _character.isPlayer) return new Error("PvP triggered");
				_combat.target = target;
			};

			meleeState.onLeave = function(){
				console.log("Leaving melee state");
			};

			meleeState.update = function(){

				if (!_combat.target &&
				   	!(_combat.hasOwnProperty('requests') && _combat.requests.length > 0)) {
					return false;
				}

				var result = null;
				result = brain.instincts['movement'].inRangeOf( _combat.target, 1, { range: ADJACENT_RANGE } );
				if (_.isError(result)) return result;
				if (result) {

					if (!_character.entity.path && !_combat.attackBusy) {
						var time    = now(),
							delta   = time - _combat.timeSinceLastAttack;

						// FIXME: get this number from npc
						if (delta > 500) {
							
							// Attack enemy
							result = _combat.attackTarget(_combat.target);
							if (_.isError(result)) return result;
							return result;
						}
					}

				} else {
					// Not in range, are we already on a path to the target?
					if (!_character.entity.path) {
						result = brain.instincts['movement'].chase( _combat.target, 1 );
						if (_.isError(result)) return result;
					}
				}

			};
		};

		this.setAbilities = function(_abilities){

			var result = null;
			this.abilities = {};
			for (var i=0; i<this._abilities.length; ++i) {
				var _ability = this._abilities[i];
				var ability = Resources.scripts.ai.instincts[this.name].components[_ability];
				if (ability.script) ability = ability.script;
				result = _script.addScript( new ability(_game, this, _character) );
				if (_.isError(result)) return result;
				this.abilities[_ability] = result;
			}
		};


		this.onEnter = function(instinct, data){
			this.state = this.states['melee'];
			var result = null;
			result = this.state.enter(data.enemy);
			if (_.isError(result)) return result;
		};
		
		this.onLeave = function(){
			// TODO: cleanup, leave state

			var result = null;
			if (this.state) {
				result = this.state.leave();
				if (_.isError(result)) return result;
				this.state = null;
			}

			if (this.target) {
				this.target = null;
			}

			// FIXME: not the best way to do this..
			for (var neuron in brain.neuralNet.neurons) {
				var target = brain.neuralNet.neurons[neuron].character;
				this.stopListeningToTarget(target);
			}

		};

		this.registerHook('update');
		this.update = function(){

			this.handlePendingEvents();
			if (!this.doHook('update').pre()) return;
			if (this.state) {
				var result = this.state.update();

				if (_.isError(result)) return result;
				if (result === false) {
					result = this.state.leave();
					if (_.isError(result)) return result;
					this.state = null;

					return false;
				}
			} else {
				return false;
			}

			this.doHook('update').post();
		};

		// Anytime we were attacked by someone, make note of it here. If we're not already in combat mode,
		// then this will post to the brain that we were hit and activate combat. The target will be added (or
		// updated) to our neural network, and in the case that we have a different target, our current target
		// will be reconsidered.
		this.attackedBy = function(enemy, amount){

			// TODO: add enemy to neural network

			if (!this.isActive) {

				// We're not yet attacking, let the brain know that we were attacked by somebody so that we
				// can enter combat mode
				var news = {
					instinct: 'combat',
					enemy: enemy,
					amount: amount
				};

				var result = null;
				result = brain.postNews(news);
				if (_.isError(result)) return result;
			} else {

				// TODO: not attacking this guy? reconsider targets
			}
		};

		// Set our current enemy target. If we're not in combat mode yet, then post the brain that we're going
		// to enter combat mode. This does not affect the neural network
		//
		// NOTE: NPCs aggro should affect the neural network elsewhere, and simply set the target here
		this.setTarget = function(target){

			this.Log("You really want to attack him ??", LOG_INFO);
			if (!(target instanceof Character)) return new Error("Target is not a character");

			if (this.isActive) {

				if (this.target != target) {
					this.Log("Setting new target", LOG_INFO);
					this.target = target;
				}
			} else {

				// We're not in combat mode yet. Tell the brain we'd like to attack now
				var news = {
					instinct: 'combat',
					enemy: target,
					aggro: true
				};

				var result = null;
				result = brain.postNews(news);
				if (_.isError(result)) return result;
			}
		};

		this.stopListeningToTarget = function(target){
			if (!(target instanceof Character)) return new Error("Target not a Character");

			var result = null;
			this.stopListeningTo(target);
			this.stopListeningTo(target.entity);
			result = brain.neuralNet.remove(target.entity.id);
			if (_.isError(result)) return result;

			// FIXME: what if we have news items regarding this character? Need to remove
			// those, or have a setTarget check that the target has died?
			if (this.target && this.target === target) {
				this.target = null;
			}
		};

		this.listenToTarget = function(target){
			if (!(target instanceof Character)) return new Error("Target not a Character");

			// If the entity is already in our neural net, then we're already listening to him
			if (brain.neuralNet.has(target.entity.id)) return;

			this.Log("Adding entity to our neural net");
			var neuron = brain.neuralNet.add(target);

			// listen to entity
			this.listenTo(target, EVT_DIED, function(target){
				this.Log("You died :(");
				this.stopListeningToTarget(target);
			});

			this.listenTo(target.entity, EVT_ZONE_OUT, function(target){
				this.Log("Aww you ran away! :(");
				this.stopListeningToTarget(target.character);
			});

		};

		// If we get distracted by something (eg. user clicks to walk somewhere) then leave combat and forget
		// all targets from the neural network
		this.distracted = function(){
			// TODO: only listen to distraction event when combat is active, then unlisten to it when we leave
			// combat mode

			if (this.isActive) {
				// TODO: Leave combat; forget neural network of enemies
				brain.leaveState('combat');
				var result = brain.neuralNet.reset();
				if (_.isError(result)) return result;
			}
		};



		this.globalUnload = function(){
			this.unloadListener();
		};

		this.server = {
			initialize: function(){
				_script = this;
				_combat.combatInit.bind(_combat)();
			},

			combatInit: function(){
				// TODO: FSM
				// TODO: Leave Combat 

				this._abilities = [];// TODO: fetch this from NPC
				if (!_character.isPlayer) {
					this._abilities = ['melee', 'sight'];
				}

				var result = null;
				result = this.setAbilities(this._abilities);
				if (_.isError(result)) return result;

				if (!_character.isPlayer) {
					var sight = this.abilities['sight'];
					sight.onReady = function(){
						sight.hook('see', this).after(function(character){
							if (character.isPlayer) {
								console.log("I WANT TO ATTACK YOU!!!");

								// TODO: fix this; should be a better way to enable aggro
								if (!this.target) {
									var result = null;
									result = _combat.attackedBy(character, 0);
									if (_.isError(result)) throw result;
									result = _combat.listenToTarget(character);
									if (_.isError(result)) throw result;
								}
							}
						});
					}.bind(this);
				}

				// TODO: upstream to listen to character
				_script.listenTo(_character, EVT_ATTACKED).after(function(_character, enemy, amount){
					_combat.attackedBy(enemy, amount);

					if (_character.isPlayer) {

					} else {
						var result = _combat.listenToTarget(enemy);
						if (_.isError(result)) throw result;
					}
				});

				_script.listenTo(_character, EVT_DISTRACTED).after(function(){
					var result = _combat.distracted();
					if (_.isError(result)) throw result;
				});

				if (_character.isPlayer) {
					console.log("You are a player");
					var player = _character.entity.player;

				   _combat.requests = [];

				   this.update = function(){
					   if (this.requests.length !== 0) {
						   while (this.requests.length) {
							   // Attempt to handle each request
							   // NOTE: must handle requests in order
							   var request = this.requests[0],
								   result  = null,
								   handler = this.handler(request.request);
							   if (handler) {
								   result = handler.call(request);

								   if (_.isError(result)) return result;
								   if (result !== true) {
									   var time = now();
									   if (time - request.time > 3000) {

										   this.Log("Could not perform request in time..", LOG_ERROR);
										   player.respond(request.evtid, false, {
											   msg: "Could not perform request within time"
										   });

										   this.requests.shift();
										   continue;
									   }
									   break;
								   }

								   player.respond(request.evtid, true, {
									   time: this.timeSinceLastAttack
								   });

								   this.requests.shift();
							   }
						   }

						   if (this.requests.length === 0) {
							   return false;
						   }
					   }

					   return true;
				   };


				   // Attempting to handle this attack request again
				   _combat.registerHandler(EVT_ATTACK);
				   _combat.handler(EVT_ATTACK).set(function(request){

					   if (!_.isObject(request)) return new Error("Request is not well defined");
					   if (!(request.target instanceof Character)) return new Error("Target is not a character");
					   var target = request.target;


					   // FIXME: have a canAttack function; maybe canAttack returns an object of pass/fail
					   // params
					   var result = null;
					   result = brain.instincts['movement'].inRangeOf( target, 1, { range: ADJACENT_RANGE } );
					   if (_.isError(result)) return result;
					   if (result) {
						   if (!_character.entity.path && !this.attackBusy) {
								var time    = now(),
									delta   = time - _combat.timeSinceLastAttack;

								// FIXME: get this number from npc
								if (delta > 500) {
								   result = this.attackTarget(target);
								   if (_.isError(result)) return result;
								   return result;
								}
						   }
					   }

					   return false;
				   });

				   player.registerHandler(EVT_ATTACK);
				   player.handler(EVT_ATTACK).set(function(evt, data){
					   this.Log("Player attempting to attack someone..");
					   this.Log("Target: "+data.target);

					   var target    = _character.entity.page.map.movables[data.target],
						   character = null,
						   err       = null;

					   if (!target) err = "No target currently";
					   else if (!_.isObject(target)) err = "Target not found";
					   else if (!(target.character instanceof Character)) err = "Target does not have a character reference";

					   if (!err) {
						   character = target.character;
						   if (!character.isAttackable()) err = "Character is not attackable";
					   }

					   if (err) {
						   this.Log("Disallowing user attack", LOG_ERROR);
						   player.respond(evt.id, false, {
							   reason: err
						   });
						   return;
					   }


					   _combat.requests.push({
						   request: EVT_ATTACK,
						   time: now(),
						   target: character,
						   evtid: evt.id
					   });

					   if (!_combat.isActive) {

							var news = {
								instinct: 'combat',
								enemy: character,
								aggro: true
							};

							var result = brain.postNews(news);
							if (_.isError(result)) return result;
					   }

				   });

				}

				this.addMelee();

			},

			attackTarget: function(target){
				if (!(target instanceof Character)) return new Error("Target is not a character..");
					   
				if (!target.isAttackable()) {
					return false;
				}


				this.Log("ATTACKING YOU: "+target);

				var DAMAGE = 10,
					result = null;
				this.Log(" I TOTALLY SCRATCHED YOU FOR " + DAMAGE);

				result = target.hurt(DAMAGE, _character);
				if (_.isError(result)) return result;

				this.timeSinceLastAttack = now();

				// Broadcast attack
				_character.entity.page.broadcast(EVT_ATTACKED, {
					entity: { page: target.entity.page.index, id: target.entity.id },
					target: { page: _character.entity.page.index, id: _character.entity.id },
					amount: DAMAGE,
					health: target.health
				});

				return true;
			},

			unload: function(){
				if (!_.isUndefined(_character.entity.player)) _character.entity.player.handler(EVT_ATTACK).unset();
				this.globalUnload();
			}
		};

		this.client = {
			initialize: function(){
				_script = this;
				_combat.combatInit.bind(_combat)();
			},

			combatInit: function(){

			},

			attackTarget: function(target){
					   
				if (!target.isAttackable()) {
					return false;
				}


				if (!this.attackBusy) {
					this.attackBusy = true;

					// Server request to attack
					server.request(EVT_ATTACK, {
						target: target.entity.id
					}).then(function(){
						console.log("Success in attacking target..");
						this.timeSinceLastAttack = now(); // TODO: get now from server response
						this.attackBusy = false;
					}.bind(this), function(){
						console.error("FAILED TO ATTACK TARGET.."); // TODO: get error msg from server response
						this.attackBusy = false;
					}.bind(this))
					.catch(Error, function(e){ errorInGame(e); })
					.error(function(e){ errorInGame(e); });
				}

				return true;
			},

			setToUser: function(){

				var result = null;
				this._abilities = [];// TODO: fetch this from NPC
				if (_character.isUser) {
					this._abilities = ['melee'];
					result = this.setAbilities(this._abilities);
					if (_.isError(result)) return result;
				}

				for (var abilityID in this.abilities) {
					var ability = this.abilities[abilityID];
					if (ability.hasOwnProperty('setToUser')) {
						result = ability.setToUser();
						if (_.isError(result)) return result;
					}
				}

				this.addMelee();

				// TODO: upstream from characer
				_script.listenTo(_character, EVT_ATTACKED).after(function(_character, enemy, amount){
					var result = null;
					result = _combat.attackedBy(enemy, amount);
					if (_.isError(result)) throw result;
					result = _combat.listenToTarget(enemy);
					if (_.isError(result)) throw result;
				});

				_script.listenTo(_character, EVT_DISTRACTED).after(function(){
					var result = null;
					result = _combat.distracted();
					if (_.isError(result)) throw result;
				});

				user.hook('clickedEntity', user).after(function(entity){

					var character = entity.character;
					if (character.isPlayer) {
						// TODO: follow player
						return;
					}

					var result = null;
					result = _combat.listenToTarget(character);
					if (_.isError(result)) return result;
					result = _combat.setTarget(entity.character);
					if (_.isError(result)) return result;
				}.bind(this));

				user.hook('clickedTile', user).after(function(){
					var result = null;
					result = _combat.distracted();
					if (_.isError(result)) return result;
				}.bind(this));
			},

			unload: function(){
				if (!_.isUndefined(user)) user.unhook(this);
				this.globalUnload();
			}
		};
	};

	return Combat;
});
