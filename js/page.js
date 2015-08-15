define(['eventful','movable','loggable','hookable'], function(Eventful,Movable,Loggable,Hookable){




	/* Page
	 *
	 * Map is stored in pages; each page fills up the entire view of the screen. Pages are linked in an
	 * octree, and at any given moment the current page and its immediate neighbours are loaded into memory
	 *
	 * Pages have a messaging service to communicate with the server. Players are attached to a queue on the
	 * server's page, and all updates are streamed to the player. 
	 *
	 * NOTE: the edges of the page are shared with its neighbours, and movables will belong to both of the
	 * 		pages at the same time
	 *********************************************************/
	var Page = function(map){
		extendClass(this).with(Eventful);
		extendClass(this).with(Loggable);
		extendClass(this).with(Hookable);
		Ext.extend(this,'page');

		this.baseTile = null; // Base tile 
		this.tiles = []; // Specific tiles to render ontop of base

		this.sprites       = {};
		this.movables      = {};
		this.items         = {};
		this.interactables = {};

		// A matrix of collidable tiles; each element is a number which represents the i_th row of this page.
		// That number is a bitmask where 1 represents a collision and 0 is an open tile
		this.collidables = [];
		for (var y=0; y<Env.pageHeight; ++y) { this.collidables[y]=0; }

		this.updateList   = [];
		this.eventsQueue  = [];
		this.eventsBuffer = []; // To be sent out to connected users
		this.clients      = [];

		this.map   = map;
		this.index = null;
		this.y     = null;
		this.x     = null;
		this.neighbours = {
			northwest:null,
			north:null,
			northeast:null,
			southeast:null,
			south:null,
			southwest:null
		};

		this.zoneEntity = function(newPage, entity){

			var result      = null,
				foundEntity = null;

			// Remove from this page
			if (!_.has(this.movables, entity.id)) throw new Error("Entity not in movables list ("+ this.index +")");
			delete this.movables[entity.id];
			foundEntity = false;
			for (var i=0; i<this.updateList.length; ++i) {
				if (this.updateList[i] == entity) {
					this.updateList.splice(i,1);
					foundEntity = true;
					break;
				}
			}
			if (!foundEntity) throw new Error("Entity was not in update list ("+ this.index +")");

			this.stopListeningTo(entity);

			// Add to new page
			// NOTE: if newPage === null then this is probably a client w/out the page loaded
			if (!newPage && Env.isServer) throw new Error("No new page given for entity zoning");
			if (newPage) {
				result = newPage.addEntity(entity);
				if (_.isError(result)) throw result;
			}

			// FIXME: WHY IS THIS NOT ENABLED FOR SERVER?!
			// if (!Env.isServer) {
				entity.page = newPage;
			// }
		};

		this.addEntity = function(entity) {
			if (entity.step) {
				if (_.has(this.movables, entity.id)) throw new Error("Entity ("+ entity.id +") already in movables");

				this.updateList.push(entity);
				this.movables[entity.id] = entity;

				// TODO: check if movable before checking zone_out
				if (entity instanceof Movable) {
					this.triggerEvent(EVT_ADDED_ENTITY, entity);
					this.Log("Adding Entity["+ entity.id +"] to page: "+ this.index);
				}
				// TODO: if wakable/sleepable? add listener for wakeup/sleep
			}

		};

		this.step = function(time) {
			var update  = null,
				result  = null;

			this.handlePendingEvents();
			for (var i=0; i<this.updateList.length; ++i) {
				update  = this.updateList[i];
				result  = update.step(now());
				if (_.isError(result)) throw result;
			}
		}; 

	};

	return Page;

});
