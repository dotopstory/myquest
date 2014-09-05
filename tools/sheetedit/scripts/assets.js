
var AssetsManager = function(assets, container){

	var interface = {
		onClickTilesheet: new Function(),
		onClickSpritesheet: new Function(),
		onClickNPC: new Function()
	},  _el = null,
		assets = assets,
		modifiedList = [];

	// Setup html
	_el = $('<div/>').addClass('assets');

	for (var assetType in assets) {
		var assetHead = assets[assetType],
			assetContainer = $('<div/>')
								.addClass('assetContainer')
								.append( $('<span/>').addClass('assetTitle').text( assetHead.title ) );
			assetList = assetHead.list;

		for (var i=0; i<assetList.length; ++i) {
			var asset = assetList[i],
				assetEl = $('<a/>')
								.attr('href', true)
								.addClass('asset')
								.data( 'type', assetType )
								.data( 'asset', asset )
								.text( asset.id );

			assetContainer.append( assetEl );

			assetEl.click(function(){

				var assetType = $(this).data('type'),
					asset     = $(this).data('asset');
				if (assetType == 'tilesheets') interface.onClickTilesheet( asset, $(this) );
				else if (assetType == 'spritesheets') interface.onClickSpritesheet( asset, $(this) );
				else interface.onClickNPC( asset, $(this) );

				return false;
			});

			assetEl.data('modify', function(){
				for (var i=0; i<modifiedList.length; ++i) {
					if ($(this) == modifiedList[i]) return;
				}
				modifiedList.push( $(this) );
				$(this).addClass('modified');
				$('#assetsArea').addClass('modified');
				$('#assetsSave').addClass('modified');
			});
			// assetEl.click((function(){
			// 	var clickType = null; 
			// 	if (assetType == 'tilesheets') clickType = interface.onClickTilesheet;
			// 	else if (assetType == 'spritesheets') clickType == interface.onClickSpritesheet;
			// 	else clickType == interface.onClickNPC;

			// 	return function(){ clickType(asset); return false; };
			// }()));
			// TODO: event handling (select, deselect, hover, unhover)
			// TODO: ajax loading, ajax saving, promises
		}

		_el.append( assetContainer );
	}

	$(container).append( _el );


	$('#assetsSave').data('assets', assets).click(function(){

		$.post('assets.php', { assets: assets }, function(data){
			var json = JSON.parse(data);
			console.log('success: '+(!!json.success?'true':'false'));

			for (var i=0; i<modifiedList.length; ++i) {
				modifiedList[i].removeClass('modified');
			}
			modifiedList = [];
			$('#assetsArea').removeClass('modified');
			$('#assetsSave').removeClass('modified');
			// TODO: effects to show that save was successful
		});

		return false;
	});

	return interface;
};
