define(['eventful'], function(Eventful){ 

	var AIComponent = function(character, initialState){
		extendClass(this).with(Eventful);

		this.entity = character;
		this.state  = new State(initialState);
		this.brain  = character.brain;
	};

	var AIComponents = {
		"Follow": function(character){

			var STATE_IDLE = 0,
				STATE_FOLLOWING = 1,
				STATE_CHASING = 2;

			this.base = AIComponent;
			this.base(character, STATE_IDLE);

			this.target = null;
			this.listenTo(character, EVT_NEW_TARGET, function(me, target){
				this.state.transition(STATE_FOLLOWING);
				this.target = target;
			});

			this.listenTo(character, EVT_REMOVED_TARGET, function(me, oldTarget){
				this.state.transition(STATE_IDLE);
				this.target = null;
			}, HIGH_PRIORITY);

			this.listenTo(character, EVT_DISTRACTED, function(me){
				if (this.target) {
					this.state.transition(STATE_IDLE);
					this.target = null;
				}
			}, HIGH_PRIORITY);

			this.step = function(time){

				if (this.state.state == STATE_FOLLOWING) {
					if (this.entity.inRangeOf(this.target)) {
						// Continue following..
					} else {
						this.state.transition(STATE_CHASING);
					}
				}

				if (this.state.state == STATE_CHASING) {

					// Reconsider route??
					if (!this.state.hasOwnProperty('reconsideredRoute') ||
						(time - this.state.reconsideredRoute) > 200) {
						// TODO: different maps? skip this.. continue using same route
						var me           = this,
							you          = this.target,
							page         = this.entity.page,
							map          = page.map,
							myY          = page.y * Env.tileSize + this.entity.posY,
							myX          = page.x * Env.tileSize + this.entity.posX,
							nearestTiles = map.findNearestTiles(myY, myX),
							yourPage     = you.page,
							yourY        = yourPage.y * Env.tileSize + you.posY,
							yourX        = yourPage.x * Env.tileSize + you.posX,
							yourNearTiles= map.findNearestTiles(yourY, yourX),
							toTiles      = map.getTilesInRange( yourNearTiles, 1, true );

						toTiles = toTiles.filter(function(tile){
							return me.entity.tileAdjacentTo(tile, you);
						});
						var	path         = map.findPath(nearestTiles, toTiles);
						if (path) {

							if (path.path) {

								var startTile = path.start.tile,
									recalibrateY = false,
									recalibrateX = false,
									path = path.path;
								if (this.entity.posY / Env.tileSize - startTile.y >= 1) throw "BAD Y assumption";
								if (this.entity.posX / Env.tileSize - startTile.x >= 1) throw "BAD X assumption";
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
				if (this.target) this.stopListeningTo(this.target);
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
						flee: 0
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

				console.log("["+this.entity.id+"] Attacked");
				if (this.target === target) return;
				if (target.physicalState.state !== STATE_ALIVE) return; // He's already died since the attack
				if (this.state.state === STATE_PASSIVE) return; // Too passive to care of this attack
				if (!this.target) {
					this.brain.setTarget(target);
					this.state.transition(STATE_ATTACKING);
					this.target = target;
				}

				if (!this.attackList[target.id]) {
					this.attackList[target.id] = {
						target: target,
						flee: 0
					}
				}

				this.setTarget(target);
			});

			this.nextTarget = function(){
				if (!isObjectEmpty(this.attackList)) {
					this.setTarget( frontOfObj(this.attackList) );
					this.brain.setTarget(this.target);
					this.state.transition(STATE_ATTACKING);
				} else {
					this.brain.setTarget(null);
					this.state.transition(STATE_IDLE);
					this.target = null;
				}
			};

			this.setTarget = function(target){

				console.log("["+this.entity.id+"] I'm attacking ["+target.id+"]");
				this.target = target;

				this.listenTo(target, EVT_DIED, function(target){

					delete this.attackList[target.id];

					console.log("["+this.entity.id+"] WHELP I suppose ("+target.id+") is dead now..");
					console.log(this.attackList);
					this.stopListeningTo(target);

					this.nextTarget();
				}, HIGH_PRIORITY);

				this.listenTo(target, EVT_ZONE_OUT, function(target){
					console.log("["+this.entity.id+"] I guess ("+target.id+") has zoned..");
					this.attackList[target.id].flee = now();
					this.stopListeningTo(target);
					this.listenTo(target, EVT_ZONE_OUT, function(target, map, page){
						// TODO: if same map, check if within range
						this.stopListeningTo(target);
						this.attackList[target.id].flee = 0;
						this.setTarget(target);
						this.brain.setTarget(this.target);
						this.state.transition(STATE_ATTACKING);
					});

					this.nextTarget();
				}, HIGH_PRIORITY);
			};

			this.listenTo(character, EVT_NEW_TARGET, function(me, attacker){
				console.log("["+this.entity.id+"] Found new target");
				if (this.target === attacker) return; // NOTE: we most likely set this ourselves already
				this.setTarget(attacker);
			});

			this.listenTo(character, EVT_REMOVED_TARGET, function(me, oldTarget){
				if (this.target === oldTarget) {
					console.log("Removing target");
					console.log(this.attackList);
					delete this.attackList[this.target.id];
					console.log(this.attackList);
					this.nextTarget();
				}
			}, HIGH_PRIORITY);

			this.listenTo(character, EVT_DISTRACTED, function(me){
				if (this.target) {
					this.brain.setTarget(null);
					this.state.transition(STATE_PASSIVE);
					this.target = null;
					this.passiveTime = now();
				}
			}, HIGH_PRIORITY);

			this.step = function(time){
				if (this.state.state === STATE_ATTACKING) {
					if (!this.target) throw new UnexpectedError("ERROR: Attacking when there is no target");
					if (time - this.lastAttacked > 750) {
						if (this.entity.inRangeOf(this.target)) {
							// Attack
							this.target.hurt(10, this.entity);
							console.log("Hurt target by 10");
							this.lastAttacked = time;
							this.entity.triggerEvent(EVT_ATTACKED_ENTITY, this.target); // TODO: this should be EVT_ATTACKED
						}
					}
				} else if (this.state.state === STATE_PASSIVE) {
					if (time - this.passiveTime > 1500) {
						this.state.transition(STATE_IDLE);
					}
				}

				var boredList = [];
				for (var k in this.attackList){
					if (this.attackList[k].flee &&
						this.attackList[k].flee + 5000 > time) {
							console.log("["+this.entity.id+"] It's been too long... ignoring the runaway ("+this.attackList[k].target.id+")");
							this.stopListeningTo(this.attackList[k].target);
							boredList.push(k);
						}
				}
				if (boredList) {
					for (var i=0; i<boredList.length; ++i) {
						delete this.attackList[ boredList[i] ];
					}
				}


				this.handlePendingEvents();
			};

			this.reset = function(){
				this.state.transition(STATE_IDLE);
				if (this.target) this.stopListeningTo(this.target);
				this.target = null;
				this.attackList = {};
				this.lastAttacked = 0;
			};
		}
	};

	/* AI
	 *
	 * Responsible for being the brain of the entity
	 ***********************************************/
	var CoreAI = function(entity){
		extendClass(this).with(Eventful);

		var STATE_IDLE = 1,
			STATE_TARGET = 2,
			STATE_MINDLESS = 3;

		this.entity = entity;
		this.state  = new State(STATE_IDLE);
		this.target = null;
		this.components = [];

		this.setTarget = function(target){
			if (!this.target && !target) return;
			if (this.state.state === STATE_MINDLESS) return; 

			if (target) console.log("["+this.entity.id+"] brain.setTarget("+target.id+")");
			else console.log("["+this.entity.id+"] brain.setTarget(null)");

			if (this.target) {
				this.entity.triggerEvent(EVT_REMOVED_TARGET, this.target);
			}

			this.target = target;
			if (target) {
				this.entity.triggerEvent(EVT_NEW_TARGET, target);
				this.listenTo(target, EVT_ZONE_OUT, function(){
					console.log("["+this.entity.id+"] I guess ("+target.id+") has zoned..");
					this.setTarget(null);
				}, HIGH_PRIORITY);
			}
		};
		
		this.step = function(time){
			if (this.state.state === STATE_MINDLESS) return;

			for (var i=0; i<this.components.length; ++i) {
				this.components[i].step(time);
			}

			this.handlePendingEvents();
		};

		this.addComponent = function(Component){
			this.components.push(new Component(this.entity));
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
