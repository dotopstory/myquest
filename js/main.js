				// TODO:
				//
				// 	> main.js (refactoring)
				// 		- remove try/catch; return error objects from functions
				// 		- debug.js, client/debug.js, server/debug.js: various debugging things,  window['TheOtherPlayer'] = ...
				// 		- pathfinding.js
				//
				// 	> server.js (refactoring)
				// 		- clean requirejs (should only require once); define?  maybe requirejs inside loading() loaded() ? (breakpoints work immediately)
				//
				//	> D/C queue; play player on D/C queue, D/C player when ready
				//	> CLEAN: plan out: sprite, animable, movable, entity  object heirarchy... server doesn't need animable? what about special NPC's? Player objects?  ---- Player, Character, NPC, Mob
				//	> CLEAN: clean up properties/method names...abstract ALL methods into units of code; the name of method describes precisely what its doing (without side effects) and the name of the property describes precisely what it is
				//	> Adopt Jasmine unit testing
				//	> server: abstract user & message queue as much as possible to allow for replays later on (saving batches of the message queue, reading it back in later); should also be able to load a debug client for viewing step-by-step operations during replay.. possible for doing this on client as well?
				//	> tools: fix + usage notes for tilesheet editor; use tilesheet editor for both animations + tiles; load resources.json on tilesheet editor to load all assets in list (easy access); npc tilesheets for maps; parse map spawns (find npc from npc tilesheets, then match to correct npc); automated updateAssets script
				//
				//
				//
				//
				//
				// 	> BAD COMBAT -- slow & buggy during circular attack and running off :: bad movement, player aggro without wait time after moving, NPC sits idle without chasing players (until player moves again to trigger them), if the wrong NPC attacks player and player can't reach their target then they don't switch to new NPC, I'm Attacking [X] shows different numbers for NPC's when they're both hitting same target
				// 		- look at ALL places outside of AI which may call AI listened events; keep track of these
				// 		- go through ALL core AI event handling; make necessary notes & comments
				// 		- test ONLY combat: check all event handling, make comments/notes
				// 		- test ONLY following: check all event handling, make comments/notes
				// 		- Recordable component: eventListening function which handles logging; keep track of ALL state changes, events handled; personal log function; allow enabling/disabling logging for each AI component; allow batching and serializing events, periodically add in a transaction to send to the DB; allow serializing a snapshot of the current component state (such that you can read the serialization and load it back to that exact state) - NOTE this needs to work with eventful component, AND needs to flush all Recordable components in order and in the same transactions since most will depend on each other.
				// 		- Set Recordable components: Movable, AI components, World, Map, Pages
				// 		- on D/C flush Recording
				// 		- Allow starting up from a Recording table (each table represents EITHER a date/startup_instance OR a snapshot/multiple_tables_per_game_startup); load everything in order, allow easy debugging (stopping at a certain point)
				//
				//
				// 	> player D/C
				// 		EVT_PLAYER_DISCONNECTING, EVT_PLAYER_DISCONNECTED
				// 		- put on D/C queue; set lastActive property on player
				// 		- D/C queue checks lastActive property to determine if its okay to D/C (low priority check... every 50x gameLoops?)
				// 		- broadcast D/C_Initialized key; change opacity of player
				// 		- add AI to player on D/C_Initialized
				// 		- listen to player: move, attack; change lastActive
				// 		- on D/C save player to db, dc player, broadcast D/C
				// 		- on player logon: is he currently logged on?
				// 			- on D/C queue?
				// 				- check current AI status (for client-AI), send to client for initializing
				// 				- remove AI
				// 				- client setup local AI
				// 				- remove from D/C queue; remove lastActive
				// 			- ELSE
				// 				- send D/C to current client; close connection
				// 				- accept new connection
				// 		- on client receive D/C
				// 			- stop game; change opacity of canvas
				// 		- on client receive closed connection
				// 			- stop game; change opacity of canvas
				//
				//	> coreAI evt_target_zoned (but works with combat and following components too)
				//	> BUG: walk to new page (east), doesn't set zoning to false (cant walk to west and zone back)
				//	> BUG: when client spam clicks for a path and then enters debug mode, then leaving debug mode skips him to an illegal spot
				//	> BUG: both players attack NPC; NPC chases other player to next page; the remaining player doesn't receive page change of NPC and thinks its in the same page
				//	> BUG: player doesn't receive movement update of other player
				//	> BUG: in circle attack after 1 NPC dies, the other player can't choose to attack the previous NPC (already in attackList and not re-added?)
				// 	> BUG: UI slow to update when entity zones out
				//	> BUG: server broadcast player.pages: old pages still stored in their list of pages!?
				//
				//
				//
				//	Bugs (cannot reproduce)
				// 	> BUG: multiplayer connect at different pages: doesn't show the other player, doesn't show NPC dying --- sees wrong player ID for other player
				// 	> BUG: multiplayer combat extremely slow (perhaps client side only w/ console open?)
				//
				//
				//
				//	> Loggable output to file? to UI?
				//	> physical state machine
				//	> player dying: animation, corpse, respawn -- death message; respawn to safe spot, remove corpse after some time
				//	> experience, level up; level up notification
				//	> regenerate hp
				//	> experience relative to dmg done (what about regeneration? what about healing? what about hit & run? what about too high level?)
				//	> NO experience on kills during d/c; no experience on stairdancing
				//	> aggro K.O.S.
				//
				//
				//	> CLEAN: throw as much as possible; exception handling on ALL potential throwable statements
				//	> CLEAN: sometimes buggy path movement?
				//	> CLEAN: any chance of missing page events after zoning in?
				//	> CLEAN: spam clicking movement lags out the entire game (server should ignore noisy players; client should temporarily ignore input between processing)
				//	> CLEAN: sometimes bad rendering: the.camera.updated=true fixes it? ..render before loaded?
				//	> CLEAN: clicking to move while zoning (disallow)
				//	> CLEAN: movables not sent if 2 pages away (not in initial page neighbour)
				//	> CLEAN: on-zone displays other movables in bad position
				//	> CLEAN: high CPU usage
				//	> CLEAN: remove server animations; auto client animations (facing target, etc.)
				//	> CLEAN: requestAnimation for drawing; do step function outside of drawing (NOTE: requestAnimation WILL pause when inactive; hence do not allow core/networking functionality in the rendering)
				//	> CLEAN: try/catch (performance)
				//	> CLEAN: functions have to be object properties prototype functions kill performance
				//	> CLEAN: able to handle pauses from client (page not in focus -- delayed timeouts)
				//	> CLEAN: Movable setting params before/after Ext
				//	> CLEAN: multiple target types (NPC, Tile)
				//	> CLEAN: player/NPC moves to edge of new page; they are still able to attack across pages, but this may cause issues for other clients who don't have the other page/movables in memory
				//	> CLEAN: renderer.js, rendering page & sprites & movables; render only visible portion of pages
				//	> CLEAN: adopt .bind() as much as possible (callbacks, promises, etc.)
				//	> CLEAN: tile (global/local???)
				//	> CLEAN: for(...){ ... } where functions perform chaining to variables within the for loop (errors)
				//	> CLEAN: resources initialization routine (in client/server resources.js?)
				//	> CLEAN: rendering (set base tile, and sparse sprite/base/items/movables (obj w/ key as coordinate); each tile contains the tile_id and a reference to its sheet)
				//	> CLEAN: convert server tiles to Uint8Array; each references an index of tileRefs which specify the gid; cache and send page data as a blob (for compression/throughput)
				//
				//
				//	
				//
				//
				//
				//
				//	> scripting language for combat, skills, interacting, UI, gameplay
				// 	> application (UI, login, etc.)
				// 	> combat; mob spawning; experience
				// 	> questing; dfa's
				// 	> loot; inv belt; usable items; armour, weapons; amulets/shoes/weapons/armour on sprite
				// 	> testing, logging, fault tolerance, testing server, auto bug reports, performance
				// 	> triggers, traps
				//
				// 	> animated static sprites (eg. fire)
				// 	> multi-tiled movables (eg. cthulu, boat) ;; ghost tiles which point to 1 entity, 1 visible sprite which takes up multiple tiles (like firefox)
				// 	> boat: walk on & off, can't get off on water, walk on boat while boat moving, walk on boat while boat zoning (pages, maps)
				// 	> dynamic collidables (drawbridge, shifting walls)
				//
				// 	> Env define / with(Env) ? use Env rather than 32
				// 	> draw tiles correctly (start/end) on camera update
				// 	> compress tiles w/ base tile
				// 	> better sprite representation
				// 	> abstract rendering
				// 	> cleanup main
				// 	> y direction protocol
				// 	> define direction (not "north" "east" etc) & allow (northeast == north | east)
				// 	> resource handling protocol (load everything at beginning - store locally if possible)
				// 	> awkward camera skiterring on zone
				// 	> improve messaging system between client/server
				// 	> A* pathfinding; maximum path length (server)
				// 	> pathfinding destination tile (for each walk)
				// 	> Error handling
				// 	> on zone-in, unload unecessary pages
				// 	> zone-in/out on map change, rename key for page change
				// 	> sleep/wake-up entities
				// 	> map pages -- allow empty pages (eg. U-shaped map, or map which doesn't take up whole area).. pages should be skipped (empty) and not set as neighbours to anything.. possibly affect map width/height
				// 	> save game state on server d/c
				//	> disallow same player id to connect twice
				//	> portals to different spots of the same map
				//	> entity idle
				//	> abstract custom cursors & hovering entities
				//	> EVT_MOVED_TILE, better than listening to EVT_STEP in some cases
				//	> NPC has base NPC to inherit; NPC has AI component list
				//	> death animation
				//	> debugging: monitor events -- in case the same object listens to the same event more than once
				//	> debugging: keep track of all events, and periodic snapshots of the game output to a logfile -- that logfile could be read back to re-animate the game and show step-by-step what happened and where things went wrong
				//	> sprite offset
				//	> Patches: warn users of upcoming patch -> start countdown -> shutdown & restart & wait for reply from server to start  ;;  bash script to send signal to server after countdown -> shutdown server & load new files -> restart server
				//	> Testing: use various test scripts; server runs test script (each script has the testing environment injected into it, just like the script/scriptmgr), sample shown below: (includes time-since-startup of each event to run). Use test clients to connect to the server too & send input. Allow simulating lag, bad inputs, DNS attacks from users, etc.
				//				0:00:00 - Jasmine( world.maps['main'].movables[1].move(4, NORTH) )
				//				0:04:00 - Jasmine.assert( movable[1].position.y == 4 )
				//
				//  > TODO: protocol for: archiving paths / events / requests / responses (push archives); map/zones; abstract pathfinding & tiles/positions/distances; efficient path confirmation / recalibration on server; dynamic sprites (path-blocking objects & pushing entities); server path follows player requested paths (eg. avoiding/walking through fire, server path should do the same)
				//
				// 	> WebRTC UDP approach ( && archive events)
				// 	> Webworkers for maps/pages on server & Transferable objects
				// 	> Db sharding
				// 	> Caching techniques (hot/cold components; cache lines)

define(['jquery','resources','entity','movable','map','page','client/camera','client/serverHandler','loggable','client/renderer','client/ui','scriptmgr','client/user'], function($,Resources,Entity,Movable,Map,Page,Camera,ServerHandler,Loggable,Renderer,UI,ScriptMgr,User) {
try{

	extendClass(this).with(Loggable);
	this.setLogPrefix('(main) ');


	// ----------------------------------------------------------------------------------------- //
	// ----------------------------------------------------------------------------------------- //
	// ----------------------------------------------------------------------------------------- //
	// ----------------------------------------------------------------------------------------- //

	var modulesToLoad          = {},
		ready                  = false,
		LOADING_CORE           = 1,
		LOADING_RESOURCES      = 2,
		LOADING_CONNECTION     = 3,
		LOADING_INITIALIZATION = 4,
		LOADING_FINISHED       = 5,
		loadingPhase           = LOADING_CORE,
		loading                = function(module){ modulesToLoad[module] = false; },
		initializeGame         = null,
		startGame              = null,
		player                 = {},
		server                 = null,
		renderer               = null,
		ui                     = null,
		listenToPlayer         = null,
		loaded=function(module){
			if (module) {
				console.log("Loaded: "+module);
				delete modulesToLoad[module];
			}
			if (ready && _.size(modulesToLoad)==0) {
				++loadingPhase;
				if (loadingPhase==LOADING_RESOURCES) loadResources();
				else if (loadingPhase==LOADING_CONNECTION) connectToServer();
				else if (loadingPhase==LOADING_INITIALIZATION) initializeGame();
				else if (loadingPhase==LOADING_FINISHED) startGame();
			}
		}, connectToServer=function(){
			// Connect to the server

			server = new ServerHandler();
			var testingLocal = true,
				link = null;
			if (testingLocal) {
				link = 'ws://127.0.0.1:1338/';
			} else {
				link = 'ws://54.86.213.238:1338/';
			}



			listenToPlayer = function(){

				// The.player.addEventListener(EVT_ZONE, ui, function(player, oldPage, newPage, direction){

				// });

				// NOTE: need to reset map listeners since this was all cleared when reloading scripts
				The.player.addEventListener(EVT_ZONE, The.map, function(player, oldPage, newPage, direction){
					console.log("Zone to "+newPage.index);
					this.zone(newPage);
				});

				The.player.addEventListener(EVT_FINISHED_PATH, this, function(player, walk){
					ui.tilePathHighlight = null;
				});

				The.player.addEventListener(EVT_PREPARING_WALK, this, function(player, walk){

					Log("Preparing to walk..");
					var playerPosition = { y: The.player.position.global.y,
										   x: The.player.position.global.x,
										   globalY: The.player.position.tile.y,
										   globalX: The.player.position.tile.x },
						state = {
							page: The.map.curPage.index,
							localY: The.player.position.local.y,
							localX: The.player.position.local.x,
							y: playerPosition.y,
							x: playerPosition.x,
							globalY: playerPosition.globalY,
							globalX: playerPosition.globalX
						};

					var onTileY = state.y % 16 == 0,
						onTileX = state.x % 16 == 0;
					if (!onTileY && !onTileX) {
						debugger;
						console.error("BAD STATE FOR WALK!");
						return;
					}

					this.Log("Sending walkTo request", LOG_DEBUG);
					this.Log(state, LOG_DEBUG);
					
					server.walkTo(walk, state).then(function(){
					}, function(response){
						// not allowed...go back to state
						console.error("Going back to state..");
						console.error(state);
						console.error(event);

						tilePathHighlight=null;

						The.map.curPage = The.map.pages[state.page];
						if (response.state) {
							The.player.position.local.y = response.state.localY;
							The.player.position.local.x = response.state.localX;
						} else {
							The.player.position.local.y = state.localY;
							The.player.position.local.x = state.localX;
						}
						The.player.updatePosition();
						The.player.path = null;
						// The.player.lastMoved = null;
						The.player.sprite.idle();
						ui.updatePages();
					});

				});
			};

			server.onDisconnect = function(){
				Log("Disconnected from server..");
			};

			server.onNewCharacter = function(player){
				Log("Created new character "+player.id);
				var id = player.id;
				localStorage.setItem('id', id);
				server.login(id);
			};

			server.onLogin = function(player){

				Log("Logged in as player "+player.id);
				The.player      = true; // NOTE: this is used to help the initiatilization of Movable below to determine that it is our player (The.player === true)
				The.player      = new Movable('player');
				The.player.id   = player.id;

				The.player.position = {
					tile: new Tile(player.position.y, player.position.x),
					global: { y: player.position.y * Env.tileSize, x: player.position.x * Env.tileSize },
					local: null,
				};


				ready = false;
				loaded('player');

				Log("Requesting map..");
				server.requestMap();
				loading('map');
				ready = true;
			};

			server.onLoginFailed = function(evt){
				Log("Login failed", LOG_ERROR);
				Log(evt, LOG_ERROR);
			};
			
			server.onInitialization = function(evt){

				Log("Initializing map");
				The.map = new Map();
				The.map.loadMap(evt.map);
				The.map.addPages(evt.pages);


				The.camera = new Camera();
				camera     = The.camera;

				window['Movable'] = Movable;
				window['Entity'] = Entity;
				window['resources'] = Resources;
				
				listenToPlayer();

				reloadScripts();

				// TODO: debugging commands should be placed elsewhere
				window['TheOtherPlayer'] = function(){
					var otherPlayerID = null;
					for (var movableID in The.player.page.movables) {
						var movable = The.player.page.movables[movableID];
						if (movable.spriteID == 'player' &&
							movable.id != The.player.id) {

							if (otherPlayerID !== null) {
								console.error("Multiple other players on page!?");
							} else {
								otherPlayerID = movable.id;
							}
						}
					}

					if (otherPlayerID) {
						var exists = (The.player.page.movables[otherPlayerID]);
						if (exists) {
							console.log("Other player ["+otherPlayerID+"] exists");
						} else {
							console.error("Other player ["+otherPlayerID+"] does NOT exists!");
						}
					}
				};


				loaded('map');

			};


			server.connect(link).then(function(){
				// Connected

				// Attempt to login under id from localStorage (if none then creates new character)
				var id = localStorage.getItem('id');
				server.login(id);
			}, function(evt){
				console.error(evt);
			});

		};

		// Load game resources
		/////////////////////////

		loadResources = function(){
			loading('resources');

			Resources = (new Resources());
			window['Resources'] = Resources;
			// FIXME: initialize with array of resources? Shouldn't this be apart of client/server specific Resources.js?
			Resources.initialize(['sheets', 'npcs', 'items', 'scripts']).then(function(assets){


				var res = JSON.parse(assets.sheets),
					makeSheet = function(_sheet){
						var sheet = {
							file: _sheet.image,
							offset: {
								x: parseInt(_sheet.sheet_offset.x),
								y: parseInt(_sheet.sheet_offset.y),
							},
							tileSize: {
								width: parseInt(_sheet.tilesize),
								height: parseInt(_sheet.tilesize),
							},
							image: (new Image()),
							tilesPerRow: parseInt(_sheet.columns),
							data: { }
						};

						sheet.image.src = location.origin + location.pathname + sheet.file;
						return sheet;
					};
				for (var i=0; i<res.tilesheets.list.length; ++i) {
					var _sheet = res.tilesheets.list[i],
						sheet  = makeSheet( _sheet );

					if (_sheet.data.objects) {
						sheet.data.objects = {};
						for (var objCoord in _sheet.data.objects) {
							var id = _sheet.data.objects[objCoord];
							sheet.data.objects[ parseInt(objCoord) ] = id;
						}
					}

					if (_sheet.data.collisions) {
						sheet.data.collisions = [];
						for (var j=0; j<_sheet.data.collisions.length; ++j) {
							sheet.data.collisions.push( parseInt( _sheet.data.collisions[j] ) );
						}
					}

					if (_sheet.data.floating) {
						sheet.data.floating = [];
						for (var j=0; j<_sheet.data.floating.length; ++j) {
							sheet.data.floating.push( parseInt( _sheet.data.floating[j] ) );
						}
					}

					Resources.sheets[_sheet.id] = sheet;
				}

				for (var i=0; i<res.spritesheets.list.length; ++i) {
					var _sheet = res.spritesheets.list[i],
						sheet  = makeSheet( _sheet );

					sheet.data.animations = {};

					var env = {
						animations: _sheet.data.animations,
						_sheet: _sheet,
						sheet: sheet
					};

					var NOFLIPX = 1<<0,
						FLIPX   = 1<<1;
					var prepareImage = (function(){

						var animations = this.animations,
							_sheet     = this._sheet,
							sheet      = this.sheet;


						// Figure out the dimensions of our spritesheet
						var canvas  = document.createElement('canvas'),
							ctx     = canvas.getContext('2d'),
							allRows = {},
							rows    = 0,
							cols    = 0,
							tWidth  = sheet.tileSize.width,
							tHeight = sheet.tileSize.height;
						for (var key in animations){
							var ani   = animations[key],
								row   = parseInt(ani.row),
								len   = parseInt(ani.length),
								flipX = (ani.hasOwnProperty('flipX') && ani.flipX == "true");
							if (!allRows[row]) {
								allRows[row] = { flipX: (ani.flipX?FLIPX:NOFLIPX) };
								++rows;
							} else if (!(allRows[row].flipX & (flipX?FLIPX:NOFLIPX))) {
								allRows[row].flipX |= (flipX?FLIPX:NOFLIPX);
								++rows;
							}

							if (len > cols) {
								cols = len;
							}
						}

						canvas.height = tHeight * rows;
						canvas.width  = tWidth  * cols;

						// Draw animations to sheet
						var iRow = 0;
						for(var key in animations){
							var ani = animations[key],
								row   = parseInt(ani.row),
								len   = parseInt(ani.length);
							if (ani.hasOwnProperty('flipX')) {


								try {
									// For Chrome
									ctx.save();
									ctx.scale(-1,1);
									for(var i=len-1, j=0; i>=0; --i, ++j) {
										ctx.drawImage(sheet.image, i*tWidth - sheet.offset.x, row*tHeight - sheet.offset.y, tWidth, tHeight, -i*tWidth, iRow*tHeight, -tWidth, tHeight);
									}
									ctx.restore();
								} catch(e) {
									// For Firefox
									// ctx.scale(-1,1);
									ctx.restore();
									ctx.save();
									ctx.scale(-1,1);
									for(var i=len-1, j=0; i>=0; --i, ++j) {
										ctx.drawImage(sheet.image, j*tWidth, row*tHeight, tWidth, tHeight, -(j+1)*tWidth, iRow*tHeight, tWidth, tHeight);
									}
									ctx.restore();
									// for(var i=ani.length-1, j=0; i>=0; --i, ++j) {
									// 	ctx.drawImage(sheet.image, j*32, ani.row*32, 32, 32, j*32, 0, 32, 32);
									// }
									// ctx.transform(-1,0,0,1,0,0);  
								}

							} else {
								ctx.drawImage(sheet.image, -sheet.offset.x, row*tHeight - sheet.offset.y, tWidth*len, tHeight, 0, iRow*tHeight, tWidth*len, tHeight);
							}

							ani.row = (iRow++);
							ani.length = len;
							delete ani.flipX;
							sheet.data.animations[key] = ani;
						}

						sheet.image = new Image();
						sheet.image.src = canvas.toDataURL("image/png");

					}.bind(env));

					sheet.image.onload = prepareImage;
					if (sheet.image.complete) prepareImage(); // In case its already loaded

					Resources.sprites[_sheet.id] = sheet;
				}






				res = JSON.parse(assets.npcs).npcs;

				// Load NPC's
				for (var i=0; i<res.length; ++i) {
					var npc = res[i];
					Resources.npcs[npc.id]=npc;
				}


				// Items
				res = JSON.parse(assets.items).items;

				Resources.items.list = {};
				Resources.items.base = {};
				for (var i=0; i<res.length; ++i) {
					var item = res[i];
					Resources.items.list[item.id] = item;
					if (!Resources.items.base.hasOwnProperty(item.base)) {
						Resources.items.base[item.base] = null;
					}
				}
				Resources.items['items-not-loaded'] = true;
				// NOTE: save item base scripts (like scripts) loading/initialization until we've setup the
				// scripting environment


				// Scripts
				var scripts = JSON.parse(assets.scripts);
				Resources._scriptRes = scripts;
				// NOTE: save script loading/initialization until we've setup the scripting environment

				loaded('resources');
			});
		};



		loading('extensions');
		Ext.ready(Ext.CLIENT).then(function(){
			console.log("Loaded extensions..");
			loaded('extensions');
		}, function(){
			// TODO: error loading extensions..
		});


		ready=true;
		loaded(); // In case tiles somehow loaded INSTANTLY fast

		// TODO: make an item base object which the item scripts inherit from
		var ItemBase = function(itemBase){
			var item = itemBase;
			this.invoke = function(character, args){
				var new_item = new item(character, args);
				if (new_item.hasOwnProperty('client')) {
					for (var itm_key in new_item.client) {
						new_item[itm_key] = new_item.client[itm_key];
					}
					delete new_item.client;
					delete new_item.server;
				}

				if (new_item.hasOwnProperty('initialize')) {
					new_item.initialize(character, args);
				}
			};
		};

		loadItemScripts = function(){
			loading('items');
			var itemsToLoad = 0;
			_.each(Resources.items.base, function(nothing, itemBase){
				var baseFile = 'scripts/items.'+itemBase;
				++itemsToLoad;
				require([baseFile], function(baseScript){
					Resources.items.base[itemBase] = new ItemBase(baseScript);
					if (--itemsToLoad === 0) loaded('items');
				});
			});
		};

		reloadScripts = function(){

			console.log("Reloading scripts..");
			The.scripting.map = The.map;

			if (The.scriptmgr) {
				The.scriptmgr.unload();
			}

			Resources.loadScripts(Resources._scriptRes).then(function(){
				//delete Resources._scriptRes; // TODO: why delete them if this needs to be reloaded ???

				The.scriptmgr = new ScriptMgr();

				if (Resources.items.hasOwnProperty('items-not-loaded')) {
					delete Resources.items['items-not-loaded'];
					loadItemScripts();
				}
				loaded();
			}, function(){
				console.error("Could not load scripts!");
			});
		};

		// ----------------------------------------------------------------- //
		// ----------------------------------------------------------------- //
		// Game Initialization
		initializeGame = function(){

			var playerPosition = The.map.coordinates.localFromGlobal(The.player.position.global.x, The.player.position.global.y, true);
			The.map.curPage = playerPosition.page;
			The.player.page = The.map.curPage;
			The.player.position.local = playerPosition;

			The.map.curPage.addEntity( The.player );

			Log("Initializing UI");
			ui = new UI();
			ui.initialize( document.getElementById('entities') );
			ui.postMessage("Initializing game..", MESSAGE_PROGRAM);
			ui.camera = The.camera;
			ui.updatePages();


			renderer = new Renderer();
			renderer.canvasEntities    = document.getElementById('entities');
			renderer.canvasBackground  = document.getElementById('background');
			renderer.ctxEntities       = renderer.canvasEntities.getContext('2d');
			renderer.ctxBackground     = renderer.canvasBackground.getContext('2d');
			renderer.camera            = The.camera;
			renderer.ui                = ui;
			renderer.setMap( The.map );
			renderer.initialize();

			The.user = User;


			var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;





			startGame = function(){
				var speed = 30,
					gameLoop = function() {

						time = new Date().getTime();

						The.map.step(time);
						The.scriptmgr.step(time);
						The.camera.step(time);
						renderer.ui.step(time);
						renderer.render();
						

						// requestAnimationFrame(gameLoop);
						setTimeout(gameLoop, speed);
				};



				// -------------------------------------------------------------------------- //
				// -------------------------------------------------------------------------- //
				//             Server Messaging
				//
				// -------------------------------------------------------------------------- //

				server.onEntityAdded = function(page, addedEntity){

					if (The.map.movables[addedEntity.id]) {
						// NOTE: its possible that our local entity position
						// hasn't updated to the servers entity position, and
						// hence the entity is stuck in another page. As a just
						// in case, update this entity to the current
						// page/position
						if (addedEntity.id != The.player.id) {
							var entity = The.map.movables[addedEntity.id];
							entity.page.zoneEntity(The.map.pages[page], entity);
							entity.page = The.map.pages[page];
							if (entity.page) {
								// TODO: abstract pathfinding & recalibration to not have to do this..
								addedEntity.state = {
									globalY: entity.page.y + parseInt(addedEntity.localY/Env.tileSize),
									globalX: entity.page.x + parseInt(addedEntity.localX/Env.tileSize),
									localY: addedEntity.localY,
									localX: addedEntity.localX,
									y: entity.page.y*Env.tileSize + addedEntity.localY,
									x: entity.page.x*Env.tileSize + addedEntity.localX,
								};
								server.onEntityWalking(page, addedEntity);
							} else {
								entity.page.zoneEntity(null, entity);
								The.map.unwatchEntity(entity);
							}
						}
						return; // Already have this entity loaded
					}
					if (addedEntity.id == The.player.id) {

					} else {
						var entity = new Movable(addedEntity.spriteID, The.map.pages[page], { id: addedEntity.id });
						Log("Adding Entity: "+addedEntity.id);
						entity.id               = addedEntity.id;
						entity.position.local.y = addedEntity.localY;
						entity.position.local.x = addedEntity.localX;
						entity.sprite.state     = addedEntity.state;
						entity.zoning           = addedEntity.zoning;

						if (addedEntity.path) {
							var path = JSON.parse(addedEntity.path);
							entity.addPath(path);
						}

						The.map.watchEntity(entity);
						The.map.pages[page].addEntity(entity);
						entity.page = The.map.pages[page];
						entity.updatePosition();
					}

				};

				server.onEntityRemoved = function(page, removedEntity){

					if (removedEntity.id == The.player.id) return;
					Log("Removing Entity: "+removedEntity.id);

					var page   = The.map.pages[page],
						entity = page.movables[removedEntity.id];
					delete page.movables[removedEntity.id];
					for (var i=0; i<page.updateList.length; ++i) {
						if (page.updateList[i] == entity) {
							page.updateList.splice(i,1);
							break;
						}
					}

					The.map.unwatchEntity(entity);
					// TODO: stopListeningTo everything?
					page.stopListeningTo(entity, EVT_FINISHED_WALK);
					page.stopListeningTo(entity, EVT_STEP);
					page.stopListeningTo(entity, EVT_PREPARING_WALK);

				};

				server.onEntityWalking = function(page, event){

					if (event.id == The.player.id) {

					} else {
						var entPage = The.map.pages[page],
							entity = entPage.movables[event.id],
							reqState = event.state;

						if (!entity) {
							Log("Event to move entity, but entity not on same page. Ignoring event");
							return;
						}

						Log("Moving entity: "+entity.id, LOG_DEBUG);
						Log(event.state, LOG_DEBUG);
						Log(event.path, LOG_DEBUG);

						var movableState = {
								y: entity.position.local.y + entPage.y * Env.tileSize,
								x: entity.position.local.x + entPage.x * Env.tileSize,
								localY: entity.position.local.y,
								localX: entity.position.local.x,
								globalY: Math.floor(entity.position.local.y/Env.tileSize) + entPage.y,
								globalX: Math.floor(entity.position.local.x/Env.tileSize) + entPage.x },
							pathState = {
								y: reqState.y,
								x: reqState.x,
								localY: reqState.localY,
								localX: reqState.localX,
								globalY: reqState.globalY,
								globalX: reqState.globalX
							},
							path = new Path(),
							walk = new Walk(),
							maxWalk = 1500 / entity.moveSpeed, // 5*Env.tileSize,
							adjustY = 0, // NOTE: in case walk already started and we need to adjust the 
							adjustX = 0; // 	 path state

						walk.fromJSON(event.path);
						walk.walked = 0;
						path.walks.push(walk);


						var success = The.map.recalibratePath(movableState, pathState, path, maxWalk);
						if (success) {
							entity.path=null;
							entity.addPath(path);
						} else {
							// find end path and jump movable to there
							var y = pathState.y,
								x = pathState.x;
								 if (walk.direction == NORTH) y -= walk.distance;
							else if (walk.direction == SOUTH) y += walk.distance;
							else if (walk.direction == WEST)  x -= walk.distance;
							else if (walk.direction == EAST)  x += walk.distance;

							Log("COULD NOT MOVE ENTITY THROUGH PATH!! Jumping entity directly to end", LOG_WARNING);

							var localCoordinates = The.map.localFromGlobalCoordinates(pathState.globalY, pathState.globalX),
								page             = The.map.pages[page];

							if (localCoordinates instanceof Error) {
								Log("Could not find proper tile for entity..", LOG_ERROR);
								localCoordinates.print();
								return;
							}

							entity.path = null;
							if (localCoordinates.page.index != page.index) {

								delete page.movables[entity.id];
								for (var i=0; i<page.updateList.length; ++i) {
									if (page.updateList[i] == entity) {
										page.updateList.splice(i,1);
										break;
									}
								}

								// TODO: stopListeningTo everything?
								page.stopListeningTo(entity, EVT_FINISHED_WALK);
								page.stopListeningTo(entity, EVT_STEP);
								page.stopListeningTo(entity, EVT_PREPARING_WALK);

							} else {
								y -= page.y*Env.tileSize;
								x -= page.x*Env.tileSize;

								entity.position.local.y = y;
								entity.position.local.x = x;
								entity.updatePosition();
								entity.sprite.idle();
							}

						}
					}

				};

				server.onEntityHurt = function(page, hurtEntity, targetEntity, amount, health){

					console.log("ENTITY "+hurtEntity.id+" HURT BY "+targetEntity.id);
					var entity = The.map.movables[hurtEntity.id],
						target = The.map.movables[targetEntity.id];
					if (entity && target) {
						var styleType = MESSAGE_INFO;
						if (target == The.player) {
							styleType = MESSAGE_BAD;
						} else if (entity == The.player) {
							styleType = MESSAGE_GOOD;
						}
						ui.postMessage(target.npc.name + ' attacked ' + entity.npc.name + ' for ' + amount + ' damage', styleType);
						var direction = target.directionOfTarget(entity);
						target.sprite.dirAnimate('atk', direction);
						entity.character.hurt(amount, target.character, health);
					}

				};


				The.player.character.hook('die', this).then(function(){
					ui.fadeToBlack();
				});


				server.onZone = function(pages){
					// Zoning information (new pages)

					for (var pageI in pages) {
						if (The.map.pages[pageI]) {
							console.error("SERVER GAVE US A PAGE WHICH WE ALREADY HAVE!! WHAT A WASTE OF LATENCY");
							delete pages[pageI];
						}
					}

					// unload previous pages which are NOT neighbours to this page
					var existingPages = {};
					for (var pageI in The.map.pages) {
						existingPages[pageI] = true;
					}

					for (var pageI in pages) {
						delete existingPages[pageI];
					}

					delete existingPages[The.map.curPage.index];
					var neighbours = The.map.curPage.neighbours;
					for (var neighbourI in neighbours) {
						var neighbour = neighbours[neighbourI];
						if (neighbour && existingPages[neighbour.index]) {
							delete existingPages[neighbours[neighbourI].index];
						}
					}

					for (var pageI in existingPages) {
						The.map.pages[pageI].unload();
						delete The.map.pages[pageI];
					}

					The.map.addPages(pages, true); // Zoning into one of the new pages
				};

				server.onLoadedMap = function(newMap, pages, player){

					Log("Zoned to new map");
					var oldMap = The.map;

					The.map = new Map();
					The.map.loadMap(newMap);
					The.map.addPages(pages);

					oldMap.copyEventsAndListeners(The.map);
					oldMap.stopAllEventsAndListeners();
					The.player.changeListeners(oldMap, The.map);
					The.map.curPage    = The.map.pages[player.page];
					ui.clear();
					ui.updatePages();

					The.player.page = The.map.curPage;


					The.player.position = {
						tile: new Tile( parseInt(player.position.local.y/Env.tileSize) + The.map.curPage.y, parseInt(player.position.local.x/Env.tileSize) + The.map.curPage.x ),
						global: { y: player.position.local.y + The.map.curPage.y * Env.tileSize, x: player.position.local.x + The.map.curPage.x * Env.tileSize },
						local: { y: player.position.local.y, x: player.position.local.x },
					};

					reloadScripts();

					The.camera.updated = true;

					renderer.setMap( The.map );

				};

				server.onRespawn = function(map, pages, player){

					Log("Respawning..");
					The.player.health = player.health;
					The.player.physicalState.transition( STATE_ALIVE );

					var oldMap = The.map;

					The.map = new Map();
					The.map.loadMap(map);
					The.map.addPages(pages);

					oldMap.copyEventsAndListeners(The.map);
					oldMap.stopAllEventsAndListeners();
					The.player.changeListeners(oldMap, The.map);
					The.map.curPage    = The.map.pages[player.page];
					ui.clear();
					ui.updatePages();

					The.player.page = The.map.curPage;

					listenToPlayer();


					The.player.position = {
						tile: new Tile( parseInt(player.localY/Env.tileSize) + The.map.curPage.y, parseInt(player.localX/Env.tileSize) + The.map.curPage.x ),
						global: { y: player.localY + The.map.curPage.y * Env.tileSize, x: player.localX + The.map.curPage.x * Env.tileSize },
						local: { y: player.localY, x: player.localX },
					};

					reloadScripts();

					The.camera.updated = true;

					renderer.setMap( The.map );
					ui.updateAllMovables();
					ui.showMovable( The.player );
					ui.fadeIn();

				};



				// Start gameloop
				gameLoop();
			}



			// TODO: setup The.scripting interface
			The.scripting.player = The.player;
			The.scripting.UI = ui;
			The.scripting.user = User;
			The.scripting.server = {
				request: server.makeRequest.bind(server),
				registerHandler: server.registerHandler.bind(server),
				handler: server.handler.bind(server)
			};


			ready=true;


			// -------------------------------------------------------
			// -------------------------------------------------------
			// Event Listeners
			// TODO: abstract event listeners to call "tryPath" or "hoverMap"

			ui.onMouseMove = function(mouse){

				try {

					ui.tileHover = new Tile(mouse.y, mouse.x);

					ui.hoveringEntity = false;
					for (var pageID in The.map.pages) {
						var page = The.map.pages[pageID],
							offY = (The.map.curPage.y - page.y)*Env.tileSize - The.camera.offsetY,
							offX = (The.map.curPage.x - page.x)*Env.tileSize + The.camera.offsetX;
						for (var movableID in page.movables) {
							var movable = page.movables[movableID],
								px      = movable.position.local.x - offX,
								py      = movable.position.local.y - offY;
							if (movable.npc.killable) {
								if (movable.playerID) continue;
								if (mouse.canvasX >= px && mouse.canvasX <= px + 16 &&
									mouse.canvasY >= py && mouse.canvasY <= py + 16) {
										// Hovering movable
										ui.hoveringEntity = movable;
										break;
								}
							}
						}
						if (ui.hoveringEntity) break;
					}

					ui.hoveringItem = false;
					for (var pageID in The.map.pages) {
						var page = The.map.pages[pageID],
							offY = (The.map.curPage.y - page.y)*Env.tileSize - The.camera.offsetY,
							offX = (The.map.curPage.x - page.x)*Env.tileSize + The.camera.offsetX;
						for (var itemCoord in page.items) {
							var item    = page.items[itemCoord],
								localY  = parseInt(itemCoord / Env.pageWidth),
								localX  = itemCoord - localY*Env.pageWidth,
								px      = localX * Env.tileSize - offX,
								py      = localY * Env.tileSize - offY;
							if (mouse.canvasX >= px && mouse.canvasX <= px + 16 &&
								mouse.canvasY >= py && mouse.canvasY <= py + 16) {
									// Hovering movable
									ui.hoveringItem = item;
									break;
							}
						}
						if (ui.hoveringItem) break;
					}

					ui.updateCursor();

				} catch(e) {
					ui.tileHover = null;
				}

			};

			ui.onMouseDown = function(mouse){

				// Attack the enemy we're currently hovering
				if (ui.hoveringEntity) {
					The.user.clickedEntity( ui.hoveringEntity );
					return;
				}

				// Pickup item we're currently hovering
				if (ui.hoveringItem) {
					The.user.clickedItem( ui.hoveringItem );
					return;
				}

				// 	click to move player creates path for player
				var walkTo       = { x: mouse.x + parseInt(The.camera.offsetX/Env.tileSize),
									 y: mouse.y - parseInt(The.camera.offsetY/Env.tileSize) },
					playerY      = The.map.curPage.y * Env.tileSize + The.player.position.local.y,
					playerX      = The.map.curPage.x * Env.tileSize + The.player.position.local.x,
					nearestTiles = The.map.findNearestTiles(playerY, playerX),
					toTile       = The.map.tileFromLocalCoordinates(walkTo.y, walkTo.x),
					time         = now(),
					path         = The.map.findPath(nearestTiles, [toTile]);

				if (path && path.path) {
					this.Log("Path TO: ("+walkTo.y+","+walkTo.x+") FROM ("+(The.player.position.local.y/Env.tileSize)+","+(The.player.position.local.x/Env.tileSize)+") / ("+path.start.tile.y+","+path.start.tile.x+")", LOG_DEBUG);
					//console.group();
					this.Log(path, LOG_DEBUG);

					// inject walk to beginning of path depending on where player is relative to start tile
					var startTile = path.start.tile,
						recalibrateY = false,
						recalibrateX = false,
						path = path.path,
						playerPosition = { y: The.player.position.local.y + The.map.curPage.y * Env.tileSize,
										   x: The.player.position.local.x + The.map.curPage.x * Env.tileSize };
					if (The.player.position.local.y / Env.tileSize - startTile.y >= 1) throw "BAD Y assumption";
					if (The.player.position.local.x / Env.tileSize - startTile.x >= 1) throw "BAD X assumption";
					if (playerPosition.y - startTile.y * Env.tileSize != 0) recalibrateY = true;
					if (playerPosition.x - startTile.x * Env.tileSize != 0) recalibrateX = true;

					path.splitWalks();

					if (recalibrateY) {
						// Inject walk to this tile
						var distance    = -1*(playerPosition.y - startTile.y * Env.tileSize),
							walk        = new Walk((distance<0?NORTH:SOUTH), Math.abs(distance), startTile.offset(0, 0));
						this.Log("Recalibrating Walk (Y): ", LOG_DEBUG);
						this.Log("	steps: "+distance, LOG_DEBUG);
						path.walks.unshift(walk);
					}
					if (recalibrateX) {
						// Inject walk to this tile
						var distance    = -1*(playerPosition.x - startTile.x * Env.tileSize),
							walk        = new Walk((distance<0?WEST:EAST), Math.abs(distance), startTile.offset(0, 0));
						this.Log("Recalibrating Walk (X): ", LOG_DEBUG);
						this.Log("	steps: "+distance+" FROM ("+The.player.position.local.x+") TO ("+startTile.x*Env.tileSize+")", LOG_DEBUG);
						path.walks.unshift(walk);
					}
					path.walks[0].time = time;

					for (i=0; i<path.walks.length; ++i) {
						var walk = path.walks[i];
						this.Log("Walk: ("+walk.direction+", "+walk.distance+", "+walk.steps+")", LOG_DEBUG);
					}
					//console.groupEnd();

					if (path.walks.length) {
						The.player.addPath(path, true);
					}

					ui.tilePathHighlight = toTile;

				} else {
					console.log("Bad path :(");
				}

				The.user.clickedTile( toTile );
			}.bind(this);

			// Load testing tools
			//////////////////////

			var randomMapPoint = function(attemptCount) {
				if (attemptCount > 100) return null;
				var randY     = Math.floor(Math.random()*13 + 1),
					randX     = Math.floor(Math.random()*29 + 1),
							  randIndex = randY*30 + randX;
				if ( The.map.curPage.collidables[randY] & (1<<randIndex) !== 0 ) {
					return randomMapPoint(attemptCount+1);
				}
				console.log("Random Map Point: {y: "+randY+", x: "+randX+"}   ("+attemptCount+" attempts)");
				return {y: randY, x: randX, index: randIndex};
			};

			var clickPoint = function(point){
				// var evt = document.createEvent("MouseEvents"); evt.initMouseEvent("mousemove", true, true, window, 0, 0, 0, (4)*Env.tileSize*Env.tileScale + 96, (3)*Env.tileSize*Env.tileScale + 8); document.getElementById('entities').dispatchEvent( evt )
				var evt = document.createEvent("MouseEvents"),
					bounds = document.getElementById('entities').getBoundingClientRect(),
					clientY = (point.y+1)*Env.tileSize*Env.tileScale + bounds.top,
					clientX = (point.x)*Env.tileSize*Env.tileScale + bounds.left;
				activeY = point.y;
				activeX = point.x;
				// evt.initMouseEvent("mousemove", true, true, window, 0, 0, 0, clientX, clientY);
				evt.initMouseEvent("mousedown", true, true, window, 0, 0, 0, clientX, clientY);
				document.getElementById('entities').dispatchEvent( evt );
			};

		window['randomMapPoint'] = randomMapPoint;
		window['clickPoint'] = clickPoint;



		};
}catch(e){
	printStackTrace();
}
});
