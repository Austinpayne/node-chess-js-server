function validateForm(form) {
	console.log(form.ptype.value)
	console.log(form.game)
	return !!form.ptype.value;
}

function onGameSelection(selectedValue) {
	if(selectedValue) {
		$(".create-game-btn").text("Join Game");
	} else{
		$(".create-game-btn").text("Create Game");
	}
}

function onWatchGameSelection(selectedValue) {
	$(".create-game-btn").text("Watch Game");
}

function onToggle(selectedValue) {
	if(selectedValue == "human"){
		$(".game-list").show(200);
		$(".watch-game-list").hide(200);
		$(".create-game-btn").show(200);
		$(".create-game-btn").text("Create Game");
	} else if (selectedValue == "ai"){
		$(".game-list").hide(200);
		$(".watch-game-list").hide(200);
		$(".create-game-btn").show(200);
		$(".create-game-btn").text("Create Game");
	}else {
		$(".game-list").hide(200);
		$(".watch-game-list").show(200);
		$(".create-game-btn").text("Watch Game");
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

function watchRefreshGames() {
	api.findGames(function(games) {	
		var $select = $("select");
		$('select').empty();
		if(games.length == 0){
			$('select').append($('<option>', {text: "No current games"}));
		}
		else{
			for(var idx in games) {
				if (games[idx].result === "?")
				{
					$('select').append($('<option>', {
		    			text: games[idx].player1.name || games[idx].id, 
		    			value : games[idx].id
					}));
				}
			}
		}

    }, function onFail() {
    	
    });
}