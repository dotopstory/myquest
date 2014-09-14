
var Editor = function(container, sheet){

	var interface = {
		loadView: null,
		onModified: new Function(),
	}, view = null,
	   ViewType = function(buttonsContainer, settingsContainer){
		   this.show       = function(){
			   			     	buttonsContainer.removeClass('hidden');
						     	settingsContainer.removeClass('hidden');
		   				     };
		   this.hide       = function(){
			   			     	buttonsContainer.addClass('hidden');
						     	settingsContainer.addClass('hidden');
		   				     };
		   this.loadData   = new Function();  // from data, load into html
		   this.unload     = new Function();
		   this.fetchData  = new Function();  // fetch html into json data
		   this.data       = {};
		   this.components = {};
		   this.modified   = new Function();
    }, view_tilesheet   = new ViewType( $('#buttons_tilesheets'), $('#settings_tilesheet') ),
       view_spritesheet = new ViewType( $('#buttons_spritesheets'), $('#settings_spritesheet') ),
	   view_npc         = new ViewType( $('#buttons_npcs'), $('#settings_npcs') );


	// =====================================
	// Prepare Tilesheet View
	// =====================================
	

	// ------------ Components ------------ //

	view_tilesheet.components = {
		id: $('#tilesheet_id'),
		tilesize: {
			input: $('#tilesheet_tilesize'),
			value: $('#tilesheet_tilesize_value')
		},
		showgrid: $('#tilesheet_showgrid'),
		sheet_offset: {
			y: $('#tilesheet_sheet_offset_y'),
			x: $('#tilesheet_sheet_offset_x')
		},
		setCollision: $('#ctrl-collision'),
		setFloating: $('#ctrl-floating')
	};


	view_tilesheet.components.tilesize.input[0].oninput = function(){
		var newTilesize = parseInt(this.value);
		view_tilesheet.data.tilesize = newTilesize;
		view_tilesheet.components.tilesize.value.text( newTilesize );
		sheet.adjustSheet( view_tilesheet.data );
		interface.onModified();
		view_tilesheet.modified();
	};

	view_tilesheet.components.id[0].onchange = function(){
		var newID = this.value;
		view_tilesheet.data.id = newID;
		interface.onModified();
		view_tilesheet.modified();
	};

	view_tilesheet.components.showgrid[0].onchange = function(){
		var showgrid = this.checked;
		sheet.gridMode( showgrid );
	};

	view_tilesheet.components.sheet_offset.y.bind('change input mousedown', function(){
		var offset = parseInt(this.value);
		view_tilesheet.data.sheet_offset.y = offset;
		sheet.adjustSheet( view_tilesheet.data );
		interface.onModified();
		view_tilesheet.modified();
	});

	view_tilesheet.components.sheet_offset.x.bind('change input mousedown', function(){
		var offset = parseInt(this.value);
		view_tilesheet.data.sheet_offset.x = offset;
		sheet.adjustSheet( view_tilesheet.data );
		interface.onModified();
		view_tilesheet.modified();
	});

	view_tilesheet.components.setCollision[0].onclick = function(){
		sheet.setMode('collision');
		return false;
	};

	view_tilesheet.components.setFloating[0].onclick = function(){
		sheet.setMode('floating');
		return false;
	};


	// ------------ Loading/Unloading ------------ //

	view_tilesheet.loadData = function(data, linkEl){

		this.data = data;
		if (!data.data) data.data = {};
		if (!data.data.floating) data.data.floating = [];
		if (!data.data.collisions) data.data.collisions = [];

		view_tilesheet.components.id.val( data.id );
		view_tilesheet.components.tilesize.input.val( parseInt(data.tilesize) );
		view_tilesheet.components.tilesize.value.text( parseInt(data.tilesize) );
		view_tilesheet.components.sheet_offset.x.val( parseInt(data.sheet_offset.x) );
		view_tilesheet.components.sheet_offset.y.val( parseInt(data.sheet_offset.y) );

		view_tilesheet.modified = function(){
			linkEl.data('modify')( linkEl );
		};

		sheet.loadSheet( data );
		sheet.onModified = function(modified){
			if (modified.type == 'floating') {
				var _floats = [],
					floats = modified.selection.tiles;
				for (var i=0; i<floats.length; ++i) {
					var float = floats[i],
						_float = float.y * parseInt(view_tilesheet.data.columns) + float.x;
					_floats.push( _float );
				}
				view_tilesheet.data.data.floating = _floats;
			} else if (modified.type == 'collision') {
				var _collisions = [],
					collisions = modified.selection.tiles;
				for (var i=0; i<collisions.length; ++i) {
					var collision = collisions[i],
						_collision = collision.y * parseInt(view_tilesheet.data.columns) + collision.x;
					_collisions.push( _collision );
				}
				view_tilesheet.data.data.collisions = _collisions;
			}
			view_tilesheet.modified();
		};
		sheet.onSheetChanged = function(src){
			data.image = src;
			view_tilesheet.modified();
		};
	};

	view_tilesheet.unload = function(){

		view_tilesheet.components.id.val('');

	};

	view_tilesheet.fetchData = function(){
		return this.data;
	};


	// =====================================
	// Prepare Spritesheet View
	// =====================================
	
	

	// ------------ Components ------------ //

	view_spritesheet.components = {
		id: $('#spritesheet_id'),
		tilesize: {
			input: $('#spritesheet_tilesize'),
			value: $('#spritesheet_tilesize_value')
		},
		showgrid: $('#spritesheet_showgrid'),
		sheet_offset: {
			y: $('#spritesheet_sheet_offset_y'),
			x: $('#spritesheet_sheet_offset_x')
		},
		sprite_offset: {
			y: $('#spritesheet_sprite_offset_y'),
			x: $('#spritesheet_sprite_offset_x')
		},
		animations: {
			container: $('.animation_list'),
			settings: {
				container: $('.animation_settings'),
				id: $('#animation_id'),
				row: $('#animation_row'),
				length: $('#animation_length'),
				flipX: $('#animation_flipX')
			}, list: []
		},
		setAvatar: $('#ctrl-avatar'),
		setAnimation: $('#ctrl-animation')
	};


	view_spritesheet.components.tilesize.input[0].oninput = function(){
		var newTilesize = parseInt(this.value);
		view_spritesheet.data.tilesize = newTilesize;
		view_spritesheet.components.tilesize.value.text( newTilesize );
		sheet.adjustSheet( view_spritesheet.data );
		interface.onModified();
		view_spritesheet.modified();
	};

	view_spritesheet.components.id[0].onchange = function(){
		var newID = this.value;
		view_tilesheet.data.id = newID;
		interface.onModified();
		view_spritesheet.modified();
	};

	view_spritesheet.components.showgrid[0].onchange = function(){
		var showgrid = this.checked;
		sheet.gridMode( showgrid );
	};

	view_spritesheet.components.sheet_offset.y.bind('change input mousedown', function(){
		var offset = parseInt(this.value);
		view_spritesheet.data.sheet_offset.y = offset;
		sheet.adjustSheet( view_spritesheet.data );
		interface.onModified();
		view_spritesheet.modified();
	});

	view_spritesheet.components.sheet_offset.x.bind('change input mousedown', function(){
		var offset = parseInt(this.value);
		view_spritesheet.data.sheet_offset.x = offset;
		sheet.adjustSheet( view_spritesheet.data );
		interface.onModified();
		view_spritesheet.modified();
	});

	view_spritesheet.components.sprite_offset.y.bind('change input mousedown', function(){
		var offset = parseInt(this.value);
		view_spritesheet.data.sprite_offset.y = offset;
		sheet.adjustSheet( view_spritesheet.data );
		interface.onModified();
		view_spritesheet.modified();
	});

	view_spritesheet.components.sprite_offset.x.bind('change input mousedown', function(){
		var offset = parseInt(this.value);
		view_spritesheet.data.sprite_offset.x = offset;
		sheet.adjustSheet( view_spritesheet.data );
		interface.onModified();
		view_spritesheet.modified();
	});

	view_spritesheet.components.setAvatar[0].onclick = function(){
		sheet.setMode('avatar');
		return false;
	};

	view_spritesheet.components.setAnimation[0].onclick = function(){
		// sheet.setMode('animation');
		return false;
	};


	// ------------ Loading/Unloading ------------ //

	view_spritesheet.loadData = function(data, linkEl){

		this.data = data;
		if (!data.data) data.data = {};
		if (!data.data.animations) data.data.animations = {};

		view_spritesheet.components.id.val( data.id );
		view_spritesheet.components.tilesize.input.val( parseInt(data.tilesize) );
		view_spritesheet.components.tilesize.value.text( parseInt(data.tilesize) );
		view_spritesheet.components.sheet_offset.x.val( parseInt(data.sheet_offset.x) );
		view_spritesheet.components.sheet_offset.y.val( parseInt(data.sheet_offset.y) );
		view_spritesheet.components.sprite_offset.x.val( parseInt(data.sprite_offset.x) );
		view_spritesheet.components.sprite_offset.y.val( parseInt(data.sprite_offset.y) );

		view_spritesheet.components.setAnimation[0].onclick = function(){
			var animationName = 'New Animation',
				animation = {
					row: 0,
					length: 0
				};

			data.data.animations[animationName] = animation;
			var animationEl = addAnimation(animationName, animation);
			$('.animation_title', animationEl).click(); // Load animation
			interface.onModified();
			view_spritesheet.modified();
			return false;
		};

		var addAnimation = function(name, data){

				var loadAnimation = function(el){

					var name = $(el).data('animationName'),
						animation  = $(el).data('animation');

					view_spritesheet.components.animations.settings.id.val( name );
					view_spritesheet.components.animations.settings.row.val( animation.row );
					view_spritesheet.components.animations.settings.length.val( animation.length );
					view_spritesheet.components.animations.settings.flipX.prop('checked', !!animation.flipX );

					view_spritesheet.components.animations.settings.row.bind('change input mousedown', function(){
						animation.row = parseInt($(this).val());
						sheet.modifyAnimation(animation);
						interface.onModified();
						view_spritesheet.modified();
					});

					view_spritesheet.components.animations.settings.length.bind('change input mousedown', function(){
						animation.length = parseInt($(this).val());
						sheet.modifyAnimation(animation);
						interface.onModified();
						view_spritesheet.modified();
					});

					view_spritesheet.components.animations.settings.flipX[0].onclick = function(){
						var flipX = this.checked;
						if (flipX) {
							animation.flipX = true;
						} else {
							delete animation.flipX;
						}
						interface.onModified();
						view_spritesheet.modified();
					};

					sheet.setMode('animation', name);

					return false;
				}, clearAnimation = function(el){
					// var animationList = view_spritesheet.components.animations.list,
					var name = $(el).data('animationName');
					// for (var i=0; i<animationList.length; ++i) {
					// 	var _animation = animationList[i];
					// 	if (_animation.name == name) {
					// 		animationList.splice(i, 1);
					// 		break;
					// 	}
					// }
					delete view_spritesheet.data.data.animations[name];

					sheet.removeAnimation(name);
					$(el).parent().remove();
					interface.onModified();
					view_spritesheet.modified();
				}, animationEl = $('<div/>')
								.addClass('animation')
								.append( $('<a/>')
										.addClass('animation_title')
										.attr('href','')
										.text( name )
										.data('animation', data)
										.data('animationName', name)
										.click(function(){
											loadAnimation(this);
											return false;
										}) )
								.append( $('<a/>')
										.addClass('animation_remove')
										.attr('href','')
										.text('X')
										.data('animation', data)
										.data('animationName', name)
										.click(function(){
											clearAnimation(this);
											return false;
										}) );


				view_spritesheet.components.animations.container.append( animationEl );
				// view_spritesheet.components.animations.list.push( data );

				return animationEl;
			};

		for (var animationName in data.data.animations) {
			var animation = data.data.animations[animationName],
				animationEl = addAnimation(animationName, animation);
		
		
		}

		view_spritesheet.modified = function(){
			linkEl.data('modify')( linkEl );
		};

		sheet.loadSheet( data );
		sheet.onModified = function(modified){
			if (modified.type == 'animation') {
				// TODO: animation
				// var _animations = [],
				// 	animation = modified.selection.tiles;
				// for (var i=0; i<floats.length; ++i) {
				// 	var float = floats[i],
				// 		_float = float.y * parseInt(view_tilesheet.data.data.columns) + float.x;
				// 	_floats.push( _float );
				// }
				// view_tilesheet.data.data.floating = _floats;
			}
			view_spritesheet.modified();
		};
		sheet.onSheetChanged = function(src){
			data.image = src;
			view_spritesheet.modified();
		};
	};

	view_spritesheet.unload = function(){

		view_spritesheet.components.id.val('');

	};

	view_spritesheet.fetchData = function(){
		return this.data;
	};



	// =====================================
	// Prepare NPC View
	// =====================================
	
	// TODO


	// -------------------------------------------------------------------- //
	// -------------------------------------------------------------------- //
	// -------------------------------------------------------------------- //

	interface.loadView = function(viewType, data, linkEl){

		if (view) {
			view.unload();
			view.hide();
		}

		if (viewType == 'tilesheet') view = view_tilesheet;
		else if (viewType == 'spritesheet') view = view_spritesheet;
		else if (viewType == 'npc') view = view_npc;
		else {
			console.error("Bad view: "+viewType);
			return;
		}

		view.loadData(data, linkEl);
		view.show();
	};



	//> editor.js: load/switch between views (tilesheet/spritesheet/npc/intro); editing (tilesheet drag/drop, edit settings, hook buttons/settings)


	return interface;
};