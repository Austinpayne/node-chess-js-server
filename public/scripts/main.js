var Game = {}; // the state of the game according to the server

// the state of the game according to the client, used for optimized UI

var chess = new Chess(); 
var board = null; // the UI baord
var userid = null;
var lastMoveTime = null; 
var Player = null;
var AIPlayer = null;
var $board = null;
var urlParams = new URLSearchParams(window.location.search);
var GameLoopId = null;

const COUNTDOWNTIME = 2000;

window.onresize = function(){
	board.resize();
};

function pollForPlayerTwo(gameid) {
	setTimeout(function() {
		api.getGame(gameid, function onSuccess(gameres) {
			Game = gameres;
			if(Game.result === '?') {
				console.log("Waiting on playertwo")
				pollForPlayerTwo(gameid);
			} else {
				$("#loading").remove();
				createBoard(gameres);
				gameloop();
			}
		})
	}, 1000)
}

function gameloop() {
	api.getGame(Game.id, function onSuccess(gameres) {
		Game = gameres;
		lastMoveTime = Game.last_move_time;
		chess.load(Game.fen);
		board.position(Game.game.board);
		if(Game.game.turn=== 'w')
			var displayTurn = "White";
		else 
			var displayTurn = "Black";
		$("#colorTurn").html(displayTurn + "'s turn!");
		if(!(Game.result === "*" || Game.result === "?")) {
			console.log("game over! - game state: " + Game.result);
			gameover(Game.result);
		} else if(Game.game.turn.startsWith(Player.color))  {
			Player.takeTurn(updateGame); 
		} else if(Game.player2.type === 'ai')  {
			AIPlayer.takeTurn(updateGame);
		} else {
			GameLoopId = setTimeout(gameloop, 50);
		}
	});
}

function gameover(result) {
	var $message = $("#message");
	$("#colorTurn").remove();
	$("#countdown").remove();
	if(result === "1/2-1/2") {
		$message.html("It's a tie!");
	} else if(result === "1-0") {
		$message.html("White wins!");
	} else if(result === "0-1") {
		$message.html("Black wins!");
	} else {
		$message.html("Unknown state: " + Game.result);
	}

	clearTimeout(GameLoopId); // kills the loop!
}

/**
 * @param game - Server response object
 */
function updateGame(game) {
	Game = game;
	chess.load(game.fen);
	board.position(Game.game.board);
	gameloop()
}

// do not pick up pieces if the game is over
// only pick up pieces for the side to move
var onDragStart = function(source, piece, position, orientation) {
  if (!(Game.result === "*" || Game.result === "?") ||
      (Game.game.turn=== 'w' && piece.search(/^b/) !== -1) ||
      (Game.game.turn === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
};


/*
 * Once a piece has been legally moved, tell the server about the move
 */
var onDrop = function(source, target, piece, newPos, oldPos, orientation) {
  removeGreySquares();

  //doesn't move the piece on the board, only calculates if it's a valid move.
  var move = chess.move({
    from: source,
    to: target,
    promotion: 'q'
  });

  if(move !== null) {
	api.makeMove(urlParams.get("gameid"), urlParams.get("playerid"), {move : source + target}, function(gamestate) {
		updateGame(gamestate);
	});
	return true;
  } else {
  	return 'snapback';
  }
  
};


var removeGreySquares = function() {
  $('#board .square-55d63').css('background', '');
};


var greySquare = function(square) {
  var squareEl = $('#board .square-' + square);
  
  var background = '#a9a9a9';
  if (squareEl.hasClass('black-3c85d') === true) {
    background = '#696969';
  }

  squareEl.css('background', background);
};

var onMouseoverSquare = function(square, piece) {
  // get list of possible moves for this square
  var moves = chess.moves({
    square: square,
    verbose: true
  });

  // exit if there are no moves available for this square
  if (moves.length === 0) return;

  // highlight the square they moused over
  greySquare(square);

  // highlight the possible squares for this piece
  for (var i = 0; i < moves.length; i++) {
    greySquare(moves[i].to);
  }
};

var onMouseoutSquare = function(square, piece) {
  removeGreySquares();
};

var createBoard = function(game) {
	Game = game;
	var cfg = {
		position : game.game.board || 'start',
		orientation : urlParams.get('user') === 'w' ? 'white' : 'black',
		draggable : urlParams.get('ptype')  !== 'ai',
		dropOffBoard : 'snapback',
		onDragStart : onDragStart,
		onMouseoutSquare: onMouseoutSquare,
		onMouseoverSquare: onMouseoverSquare,
		onDrop : onDrop
	}
	board = ChessBoard('board', cfg);
	lastMoveTime = new Date().getTime();
	countdownTimer(Game);
}

window.onload = function() {
	gameid = urlParams.get("gameid");
	userid = urlParams.get("playerid")
	Player = PlayerFactory.getPlayer(urlParams.get('ptype'), userid, gameid, urlParams.get("user"));
	if(urlParams.get("player2id")) {		
		AIPlayer = PlayerFactory.getPlayer('ai', urlParams.get("player2id"), gameid, 'b');
	}
	$board = $("#board");
	api.getGame(urlParams.get('gameid'), function(game) {		
		if(game.player1 && game.player2) {
			createBoard(game);
        	$("#loading").remove();
        	gameloop();
		} else {
    		pollForPlayerTwo(gameid);
		}
    }, function onFail() {
    	$("#loading").html("Game not found");
    });

   
}

/*window.onbeforeunload = function() {
    return 'You have unsaved changes!';
}*/

var countdownTimer = function(game){
	// Update the count down every 1 second
	var countdownTimerId = setInterval(function() {
		// Get todays date and time
		var now = new Date().getTime();

		// Find the distance between now an the count down date
		var distance = (now -  lastMoveTime);

		// Time calculations for days, hours, minutes and seconds
		var totalSeconds = (60 * Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))) + Math.floor((distance % (1000 * 60)) / 1000);
		var timeLeft = COUNTDOWNTIME - totalSeconds

		// Display the result 
		$(".countdown .time-msg").html("TIME LEFT: ");
		$(".countdown .time-value").html(Math.floor(timeLeft/60) + "m " + timeLeft%60 + "s ");

		// If the count down is finished, write some text 
		if (timeLeft < 0) {
			$(".countdown").html("TIME IS UP!");
			var result = Game.game.turn === 'w' ? "0-1" : "1-0";
		    api.gameOver(urlParams.get("gameid"), result, function(gamestate) {
		    	clearInterval(countdownTimerId);
		    	gameover(result) // pass in loser to make it cleaner.
			})
		}
  	}, 100);
}

function startNewGame(form) {
	var result = Player.color === 'w' ? "0-1" : "1-0";
	api.gameOver(urlParams.get("gameid"), result, function(gamestate) {
	    gameover();
	    window.location = "/";
	});
}