var PlayerFactory = {
	getPlayer :  function(type, pid, gameid, color) {
		if(type === "ai") {
			return new AiPlayer(pid, gameid, color);
		} else {
			return new HumanPlayer(pid, gameid, color);
		}
	}
}

function AiPlayer(id, gameid, color) {
	var self = this;
	self.gameId = gameid;
	self.playerId = id;
	self.color = color
	self.takeTurn = function(onFinish) {
		setTimeout(function() {
			api.bestMove(self.gameId, self.playerId, function(move) {
				api.makeMove(self.gameId, self.playerId, {move : move.move},
					function(gamestate) {
						onFinish(gamestate);
					});
				}, function onError() {
					console.log("Best move errored out");
				});				
		}, 1500);
		
	}
}

function HumanPlayer(id, gameid, color) {
	var self = this;
	self.gameId = gameid;
	self.playerId = id;
	self.color = color

	self.$board = $("#board");
	self.takeTurn = function(onFinish) {
		// NO OP	
	}

}