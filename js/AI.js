define(['eventful','loggable'], function(Eventful, Loggable){ 

	var AIComponent = function(character, initialState){
		extendClass(this).with(Eventful);
		extendClass(this).with(Loggable);

		this.entity = character;
		this.state  = new State(initialState);
		this.brain  = character.brain;

		this.setLogGroup('AI');
		this.setLogPrefix('[' + this.entity.id + '](Component) ');
	};

	// TODO:
	// 	Group based Combat
	//
	// 		Use neural networks for determining groups. If a player attacks you, then that player is given a
	// 		neural node in your brain, and is set as a bad neuron. The more he attacks you, the more valuable
	// 		he becomes. If other movables do something which affects that player, they have a neuron added to
	// 		your brain too, and a weight is given to the connection between the two neurons. The more active
	// 		the two neurons are together, the strong that weight becomes, and eventually that weight could
	// 		surpass a threshold before building a connection between the two neurons (ie. two players are
	// 		grouped; or another npc is considered apart of your group).
	//
	// 		Triggers between neurons are one-way, and that weight is added to the one-way stream. A connectino
	// 		threshold may differ depending on which way the connection is being made. eg. if the player you
	// 		hate suddenly attacks another npc, how much do you have to hate that player or how much does that
	// 		player have to attack that npc before you consider that npc your friend? This should depend on
	// 		personality, and on the value you've placed on each neuron
	//
	// 		PROBLEM: what if a player heals you to get on your good side, and in turn forces you to attack an
	// 		npc?
	// 		PROBLEM: how to determine role type based off neurons that you consider friends and enemies? How
	// 		to determine which neuron to go after?

	var AIComponents = {
		"Follow": function(character){

			var STATE_IDLE = 0,
				STATE_FOLLOWING = 1,
				STATE_CHASING = 2;

			this.base = AIComponent;
			this.base(character, STATE_IDLE);

			this.setLogPrefix('[' + this.entity.id + '](Following) ');

			this.target = null;
			this.listenTo(character, EVT_NEW_TARGET, function(me, target){
				if (!this.entity.inRangeOf(target)) {
					this.state.transition(STATE_CHASING);
				} else {
					this.state.transition(STATE_FOLLOWING);
				}
				this.Log("Following ("+(target&&target.id?target.id:"null")+")");
				this.target = target;

				// NOTE: this triggers as soon as the target moves to a new tile; however inRangeOf considers
				// all nearby tiles to ourselves and the target. Hence if we are only considering adjacent
				// tiles then we need 
				if (target.triggerEvent) { // Is Eventful
					this.listenTo(target, EVT_MOVED_TO_NEW_TILE, function(target){
						if (this.state.state != STATE_CHASING && 
							!this.entity.inRangeOf(target)){

							this.state.transition(STATE_CHASING);
						}
					});
				}
			}, HIGH_PRIORITY);

			this.listenTo(character, EVT_REMOVED_TARGET, function(me, oldTarget){
				this.state.transition(STATE_IDLE);
				this.target = null;
				if (oldTarget.triggerEvent) this.stopListeningTo(oldTarget, EVT_MOVED_TO_NEW_TILE);
			}, HIGH_PRIORITY);

			this.listenTo(character, EVT_DISTRACTED, function(me){
				if (this.target) {
					this.state.transition(STATE_IDLE);
					if (this.target.triggerEvent) this.stopListeningTo(this.target);
					this.target = null;
				}
			}, HIGH_PRIORITY);

			this.step = function(time){

				if (this.state.state == STATE_CHASING) {

					// Reconsider route??
					if (!this.state.hasOwnProperty('reconsideredRoute') ||
						(time - this.state.reconsideredRoute) > 200) {
						this.Log("I'm at ("+this.entity.page.index+") chasing you at ("+this.target.page.index+")");

						// TODO: different maps? skip this.. continue using same route
						var me            = this,
							you           = this.target,
							page          = this.entity.page,
							map           = page.map,
							myY           = page.y * Env.tileSize + this.entity.position.local.y,
							myX           = page.x * Env.tileSize + this.entity.position.local.x,
							nearestTiles  = map.findNearestTiles(myY, myX),
							yourNearTiles = null,
							toTiles       = null;
						if (this.target instanceof Tile) {
							toTiles = [this.target];
						} else {
							var yourPage      = you.page,
								yourY         = yourPage.y * Env.tileSize + you.position.local.y,
								yourX         = yourPage.x * Env.tileSize + you.position.local.x,
								yourNearTiles = map.findNearestTiles(yourY, yourX);

						toTiles = map.getTilesInRange( yourNearTiles, 1, true );
						toTiles = toTiles.filter(function(tile){
							return me.entity.tileAdjacentTo(tile, you);
						});
						}

						var path = map.findPath(nearestTiles, toTiles);


						if (path) {

							if (path.path) {

								var startTile = path.start.tile,
									recalibrateY = false,
									recalibrateX = false,
									path = path.path;
								if (this.entity.position.local.y / Env.tileSize - startTile.y >= 1) throw "BAD Y assumption";
								if (this.entity.position.local.x / Env.tileSize - startTile.x >= 1) throw "BAD X assumption";
								if (myY - startTile.y * Env.tileSize != 0) recalibrateY = true;
								if (myX - startTile.x * Env.tileSize != 0) recalibrateX = true;

								path.splitWalks();

								if (recalibrateY) {
									// Inject walk to this tile
									var distance    = -1*(myY - startTile.y * Env.tileSize),
										walk        = new Walk((distance<0?NORTH:SOUTH), Math.abs(distance), startTile.offset(0, 0));
									console.log("Recalibrating Walk (Y): ");
									console.log("	steps: "+distance);
									path.walks.unshift(walk);
								}
								if (recalibrateX) {
									// Inject walk to this tile
									var distance    = -1*(myX - startTile.x * Env.tileSize),
										walk        = new Walk((distance<0?WEST:EAST), Math.abs(distance), startTile.offset(0, 0));
									console.log("Recalibrating Walk (X): ");
									path.walks.unshift(walk);
								}

								this.entity.addPath(path);

							} else {
								console.log("Path already within range");
								this.state.transition(STATE_FOLLOWING);
							}
						} else {
							console.log("No path found :(");
							console.log(path);
							console.log("Me: "+myY + "," + myX);
							console.log(nearestTiles);
							console.log("You: "+yourY+","+yourX);
							console.log(yourNearTiles);
							console.log(toTiles);
							process.exit();
						}
						this.state.reconsideredRoute = time;
						console.log("Reconsidered route at @"+this.state.reconsideredRoute);
					}
				}
					
				this.handlePendingEvents();
			};


			this.reset = function(){
				this.state.transition(STATE_IDLE);
				if (this.target && this.target.triggerEvent) this.stopListeningTo(this.target);
				this.target = null;
			};
		},
		"Combat": function(character){

			var STATE_IDLE = 0,
				STATE_ATTACKING = 1,
				STATE_ANGRY = 2,
				STATE_PASSIVE = 3;

			this.base = AIComponent;
			this.base(character, STATE_IDLE);

			this.setLogPrefix('[' + this.entity.id + '](Combat) ');

			this.target       = null;
			this.attackList   = {};
			this.lastAttacked = 0;
			this.attackRange  = 1;
			this.passiveTime  = 0;
			this.listenTo(character, EVT_AGGRO, function(me, target){
				if (this.target === target) return;
				if (target.physicalState.state !== STATE_ALIVE) return; // Cannot aggro this guy

				if (!this.attackList[target.id]) {
					this.attackList[target.id] = {
						target: target,
						flee: 0,
						listening: false
					}
				}
				
				if (this.target) {
					// TODO

				}

				console.log("["+this.entity.id+"] Aggro");
				this.brain.setTarget(target);
				this.state.transition(STATE_ATTACKING);
				this.target = target;
				this.setTarget(target);
			});

			this.listenTo(character, EVT_ATTACKED, function(me, target){

				console.log("["+this.entity.id+"] Attacked by ("+target.id+")");
				if (this.target === target) return;
				if (target.physicalState.state !== STATE_ALIVE) return; // He's already died since the attack
				if (this.state.state === STATE_PASSIVE) return; // Too passive to care of this attack

				if (!this.attackList[target.id]) {
					this.attackList[target.id] = {
						target: target,
						flee: 0,
						listening: false
					}
				}

				if (!this.target) {
					this.brain.setTarget(target); // FIXME: brain will say EVT_REMOVED_TARGET which downstreams to AI.combat and called nextTarget in turn if brain already has a target
					this.state.transition(STATE_ATTACKING);
					this.target = target;
					this.setTarget(target);
				}

			});

			this.nextTarget = function(){
				if (!isObjectEmpty(this.attackList)) {

					var availableTargets = [];
					for (var someTarget in this.attackList) {
						if (this.target && someTarget == this.target.id) continue; // Reject current target
						// TODO: check same map
						availableTargets.push( someTarget );
					}

					console.log("Available targets: ");
					console.log(availableTargets);
					if (availableTargets.length) {
						var newTarget = this.attackList[availableTargets[0]].target; // TODO: find best target based off distance/hatred
						console.log("Picking target: "+newTarget.id);
						this.brain.setTarget(newTarget);
						this.setTarget( newTarget );
						this.state.transition(STATE_ATTACKING);
					} else {
						console.log("No targets..setting target null");
						this.brain.setTarget(null);
						this.state.transition(STATE_IDLE);
						this.target = null;
					}
				} else {
					this.brain.setTarget(null);
					this.state.transition(STATE_IDLE);
					this.target = null;
				}
			};

			this.setTarget = function(target){

				console.log("["+this.entity.id+"] I'm attacking ["+target.id+"]");
				this.target = target;

				if (!this.attackList[target.id].listening) {
					this.listenTo(target, EVT_DIED, function(target){

						delete this.attackList[target.id];

						console.log("["+this.entity.id+"] WHELP I suppose ("+target.id+") is dead now..");

						// TODO: multiple listeners on same target?
						console.log("NOT LISTENING TO TARGET: ");
						for (var i=0; i<target.evtListeners[EVT_DIED].length; ++i) {
							var which = target.evtListeners[EVT_DIED][i];
							if (which.caller.attackRange) {
								console.log('	FOUND US');
							}
						}
						for (var i=0; i<target.pendingOperations.length; ++i) {
							var which = target.pendingOperations[i];
							if (which.args[0] == EVT_DIED) {
								console.log('PENDING DELETE EVT_DIED');
							}
						}

						console.log(this.attackList);
						this.stopListeningTo(target);

						this.nextTarget();

					}, HIGH_PRIORITY);

					this.attackList[target.id].listening = true;
				}

			};

			this.listenTo(this.brain, EVT_TARGET_ZONED_OUT, function(me, target){
				this.Log("Target ("+target.id+") has zoned out");
				if (this.target && (this.target.id == target.id)) {
					this.Log("We should have replaced our target before getting here", LOG_ERROR);
				}

				this.attackList[target.id].flee = now();
				this.stopListeningTo(target);

				// TODO: multiple listeners on same target?
				console.log("NOT LISTENING TO TARGET: ");
				for (var i=0; i<target.evtListeners[EVT_DIED].length; ++i) {
					var which = target.evtListeners[EVT_DIED][i];
					if (which.caller.attackRange) {
						console.log('	FOUND US');
					}
				}
				for (var i=0; i<target.pendingOperations.length; ++i) {
					var which = target.pendingOperations[i];
					if (which.args[0] == EVT_DIED) {
						console.log('PENDING DELETE EVT_DIED');
					}
				}
									

				this.listenTo(target, EVT_ZONE_OUT, function(target, map, page){
					// TODO: if same map, check if within range & hate level
					this.stopListeningTo(target);
					this.attackList[target.id].flee = 0;
					this.brain.setTarget(target);
					this.setTarget(target);
					this.state.transition(STATE_ATTACKING);
				}, HIGH_PRIORITY);

			}, HIGH_PRIORITY);

			this.listenTo(character, EVT_NEW_TARGET, function(me, attacker){
				if (attacker instanceof Tile) return; // TODO: shouldn't have to check weird stuff like this
				console.log("["+this.entity.id+"] Found new target");
				if (this.target === attacker) return; // NOTE: we most likely set this ourselves already
				this.setTarget(attacker);
			});

			// This target is no longer our current target (maybe zoned out or we changed our priority target)
			this.listenTo(character, EVT_REMOVED_TARGET, function(me, oldTarget){
				if (this.target === oldTarget) {
					console.log("Removing target "+this.target.id);
					// NOTE: do not remove this target from our attackList since we may still want to attack
					// them later (eg. if they zoned out temporarily, or we've started attacking their friend
					// instead)
					if (this.state.state !== STATE_PASSIVE) {
						this.nextTarget();
					} else {
						this.target = null;
					}
				}
			}, HIGH_PRIORITY);

			this.listenTo(character, EVT_DISTRACTED, function(me){
				if (this.target) {
					this.state.transition(STATE_PASSIVE);
					this.passiveTime = now();
					this.brain.setTarget(null);
					this.target = null;
				}
			}, HIGH_PRIORITY);

			this.step = function(time){
				if (this.state.state === STATE_ATTACKING) {
					if (!this.target) throw new UnexpectedError("ERROR: Attacking when there is no target");
					if (time - this.lastAttacked > 750 &&
					    !this.entity.path) {
						if (this.entity.inRangeOf(this.target)) {
							// Attack
							this.target.hurt(10, this.entity);
							console.log("Hurt target by 10");
							this.lastAttacked = time;
							this.entity.triggerEvent(EVT_ATTACKED_ENTITY, this.target); // TODO: this should be EVT_ATTACKED
						}
					}
				} else if (this.state.state === STATE_PASSIVE) {
					if (time - this.passiveTime > 5000) {
						this.state.transition(STATE_IDLE);
					}
				}

				var boredList = [];
				for (var k in this.attackList){
					if (this.attackList[k].flee &&
						this.attackList[k].flee + 5000 < time) {
							console.log("["+this.entity.id+"] It's been too long... ignoring the runaway ("+this.attackList[k].target.id+")");
							this.stopListeningTo(this.attackList[k].target);
							boredList.push(k);
						}
				}
				if (boredList.length) {
					for (var i=0; i<boredList.length; ++i) {
						delete this.attackList[ boredList[i] ];
					}

					if (isObjectEmpty(this.attackList)) {
						console.log("I am now BORED");
						this.brain.triggerEvent(EVT_BORED);
					}

				}



				this.handlePendingEvents();
			};

			this.reset = function(){
				this.state.transition(STATE_IDLE);
				if (this.target) this.stopListeningTo(this.target);
				for (var targetID in this.attackList) {
					this.stopListeningTo(this.attackList[targetID]);
				}
				this.target = null;
				this.attackList = {};
				this.lastAttacked = 0;
			};
		},
		"Respawn": function(character, params){

			var STATE_IDLE = 0;

			this.base = AIComponent;
			this.base(character, STATE_IDLE);

			this.setLogPrefix('[' + this.entity.id + '](Respawn) ');

			this.respawnPoint = params.respawnPoint;
			this.respawnPoint.localizeTile();

			this.listenTo(this.brain, EVT_BORED, function(brain){
				console.log("Moving to respawn point..");
				this.brain.setTarget(this.respawnPoint); // TODO: what if brain already has a target ??
			});

			this.step = function(time){
				this.handlePendingEvents();
			};

			this.reset = function(){
				
			};

			this.listenTo(this.brain, EVT_RESPAWNING, function(brain){
				this.Log("RESPAWNING");
				var page   = this.entity.page;
				delete page.movables[this.entity.id];
				for (var i=0; i<page.updateList.length; ++i) {
					if (page.updateList[i] == this.entity) {
						page.updateList.splice(i,1);
						break;
					}
				}

				page.stopListeningTo(this.entity);
				page.map.unwatchEntity(this.entity);

				this.entity.position.local.y = this.respawnPoint.y * Env.tileSize;
				this.entity.position.local.x = this.respawnPoint.x * Env.tileSize;
				this.entity.page = this.respawnPoint.page;
				this.entity.updatePosition();
				this.entity.physicalState.transition(STATE_ALIVE);
				this.entity.path = null;
				this.entity.zoning = false;
				this.entity.lastMoved=now();
				this.entity.health=this.entity.npc.health;
				this.entity.lastStep=0;
				this.entity.sprite.idle();
				this.entity.brain.reset();
				this.entity.pendingEvents=[];
				this.Log("RESPAWNED");
				this.respawnPoint.page.map.watchEntity(this.entity);
				this.respawnPoint.page.addEntity(this.entity);
			}, HIGH_PRIORITY);
		},
		"PlayerRespawn": function(character, params){

			var STATE_IDLE = 0;

			this.base = AIComponent;
			this.base(character, STATE_IDLE);

			this.setLogPrefix('[' + this.entity.id + '](Respawn) ');

			this.respawnPoint = params.respawnPoint;
			this.respawnPoint.localizeTile();

			this.step = function(time){
				this.handlePendingEvents();
			};

			this.reset = function(){
				
			};

			this.listenTo(this.brain, EVT_RESPAWNING, function(brain){
				this.Log("RESPAWNING");
				var page   = this.entity.page;
				delete page.movables[this.entity.id];
				for (var i=0; i<page.updateList.length; ++i) {
					if (page.updateList[i] == this.entity) {
						page.updateList.splice(i,1);
						break;
					}
				}

				page.stopListeningTo(this.entity);
				page.map.unwatchEntity(this.entity);

				this.entity.position.local.y = this.respawnPoint.y * Env.tileSize;
				this.entity.position.local.x = this.respawnPoint.x * Env.tileSize;
				this.entity.page = this.respawnPoint.page;
				this.entity.updatePosition();
				this.entity.physicalState.transition(STATE_ALIVE);
				this.entity.path = null;
				this.entity.zoning = false;
				this.entity.lastMoved=now();
				this.entity.health=this.entity.npc.health;
				this.entity.lastStep=0;
				this.entity.sprite.idle();
				this.entity.brain.reset();
				this.entity.pendingEvents=[];
				this.Log("RESPAWNED");
				this.respawnPoint.page.map.watchEntity(this.entity);
				this.respawnPoint.page.addEntity(this.entity);
				this.brain.triggerEvent(EVT_RESPAWNED);
			}, HIGH_PRIORITY);
		}
	};

	/* AI
	 *
	 * Responsible for being the brain of the entity
	 ***********************************************/
	var CoreAI = function(entity){
		extendClass(this).with(Eventful);
		extendClass(this).with(Loggable);

		var STATE_IDLE = 1,
			STATE_TARGET = 2,
			STATE_MINDLESS = 3;

		this.entity = entity;
		this.state  = new State(STATE_IDLE);
		this.target = null;
		this.components = [];

		this.setLogGroup('AI');
		this.setLogPrefix('[' + this.entity.id + '](Core) ');

		this.setTarget = function(target){
			if (!this.target && !target) return;
			if (this.state.state === STATE_MINDLESS) return; 
			if (this.target == target) return;

			this.Log("brain.setTarget("+((target&&target.id)?target.id:"null")+")");

			var oldTarget = this.target;
			this.target = target;
			if (oldTarget) {
				this.entity.triggerEvent(EVT_REMOVED_TARGET, oldTarget);
				if (oldTarget.triggerEvent) this.stopListeningTo(oldTarget);
			}

			if (target) {
				this.entity.triggerEvent(EVT_NEW_TARGET, target);
				if (target.triggerEvent) {
					this.listenTo(target, EVT_ZONE_OUT, function(){
						this.Log("target ("+target.id+") has zoned..");
						// NOTE: combat may try to set a new target from TARGET_ZONED_OUT, so set target to
						// null first before triggering event
						this.setTarget(null);
						this.triggerEvent(EVT_TARGET_ZONED_OUT, target);
					}, HIGH_PRIORITY);
				}
			}
		};
		
		this.step = function(time){
			if (this.state.state === STATE_MINDLESS) return;

			for (var i=0; i<this.components.length; ++i) {
				this.components[i].step(time);
			}

			this.handlePendingEvents();
		};

		this.addComponent = function(Component, params){
			this.components.push(new Component(this.entity, params));
		};

		this.reset = function(){
			this.state.transition(STATE_IDLE);
			this.target = null;
			this.pendingEvents=[];

			for (var i=0; i<this.components.length; ++i) {
				this.components[i].reset();
				this.components[i].pendingEvents=[];
			}
		};
	};


	return {
		Core: CoreAI,
		Components: AIComponents,
	};
});
