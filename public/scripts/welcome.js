
function validateForm(form) {
	if(!form.ptype.value) {
		alert("You need to select if you're a human or an AI!")
	}
	
	return !!form.ptype.value;
}

function onselection(selectedValue) {
	if(selectedValue) {
		$(".create-game-btn").text("Join Game");
	} else {
		$(".create-game-btn").text("Create Game");
	}
}

function refreshGames() {
	api.findGames(function(games) {	
		var $select = $("select");
		$('select').empty();
		$('select').append($('<option>', {text: "New Game", value : ""}));
		for(var idx in games) {
			if (games[idx].result === "?")
			{
				$('select').append($('<option>', {
	    			text: games[idx].player1.name || games[idx].id, 
	    			value : games[idx].id
				}));
			}
		}

    }, function onFail() {
    	
    });
}