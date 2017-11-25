var names = {};

function validateForm(form) {
	if(!form.ptype.value) {
		alert("You need to select if you're a human or an AI!")
	}
	names.push({idname : form.name.value});

	return !!form.ptype.value;
}

function refreshGames() {
		api.findGames(function(games) {	
		var $select = $("select");
		$('select').empty();
		$('select').append($('<option>', {text: "New Game", value : ""}));
		for(var idx in games) {
			$('select').append($('<option>', {
    			text: games[idx].player1.name || games[idx].id, 
    			value : games[idx].id
			}));
		}

    }, function onFail() {
    	
    });
}