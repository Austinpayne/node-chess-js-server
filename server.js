const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const fs = require('fs');
const Chess = require('./node_modules/chess.js/chess.js').Chess;
const net = require('net');
const crypto = require('crypto');
const stockfish = require('./stockfish_wrapper.js');
const path = require('path');
const pug = require('pug');


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('json replacer', replacer);
app.set('views', './views');
app.set('view engine', 'pug');

//-----------------------------------------------
// GLOBALS (use db later)
//-----------------------------------------------

var players = []; // currently not using
var games = {};
const DRAW = '1/2-1/2';
const IN_PROGRESS = '*';
const WHITE_WIN = '1-0';
const BLACK_WIN = '0-1';

//-----------------------------------------------
// ROUTES
//-----------------------------------------------

//-----------------------------------------------
// '/' (root)
//-----------------------------------------------

app.get('/', function(req, res) {
    res.render('welcome', {games : games, main: "scripts/welcome.js"});
});

//-----------------------------------------------
// /game
//-----------------------------------------------

/*  
    POST new game
    returns game_id and player_id
    client should store both in order to make subsequent requests
    add post body with player name, device, etc.?

    params:
    {
        name: "",
        username: "",
        mode: ['ai'|'human']
    }

    returns:
    {
        game_id: {
            id: '',
            player1: {
                id: '',
                color: ['w'|'b']
            },
            game: {...}
        },
        ...
    }
*/
app.post('/game', validate_create_game, function(req, res) {
    var player_type = req.body.player_type;
    var opponent_type = req.body.opponent_type; // optional, default human
    var start = req.body.start; // optional, start position FEN
    var chess;
    if (start)
        chess = new Chess(start);
    else
        chess = new Chess();
    var game = {id: gen_id()};
    game.created  = Date.now();
    game.last_move_time = undefined; // game created shouldn't have a last move.
    game.game = chess;
    game.player1 = create_player(player_type, 'w');
    if (opponent_type === 'ai') {
        game.player2 = create_player(opponent_type, 'b');
        game.result = "*"; // * == in-play/on-going (pgn notation)
    }
    games[game.id] = game;
    res.status(200).json(game);
    console_log("game {0} created by {1}".format(game.id, game.player1.id));
});


// GET game
app.get('/setup', function(req, res, next) {
    var params = {};
    var player_type = req.query.ptype;
    var player_name = req.query.pname;
    if(req.query.game) { // selected a game
        if(games[req.query.game]) {
            var game = games[req.query.game];
            params.gameid = game.id
            params.ptype = req.query.ptype
            game.player2 = create_player(player_type,'b', player_name);
            params.playerid = game.player2.id
            params.user = "b";
            game.result = "*";
            game.last_move_time = (Date.now()) - 1000, // minus a second on the start 
            console.log("player %s joined game %s", params.playerid, game.id);
        } else {
            res.status(301).send("game not found");
        }
    } else { // create a game
        var game = {
            id : gen_id(),
            created : Date.now(),
            last_move_time: undefined, // no moves yet!
            game : new Chess(),
            player1 : create_player(player_type, 'w', player_name),
            result : "?", // waiting
        }
        games[game.id] = game;
        params.gameid = game.id;
        params.user = "w";
        params.ptype = req.query.ptype
        params.playerid = game.player1.id

        console_log("game {0} created by {1}".format(game.id, game.player1.id));
    }
    var queryParams = serialize(params);
    res.redirect('/ui?' + queryParams);
});

app.get('/ui', function(req, res, next){
    res.render('main', {main: "scripts/main.js"});
});

app.get('/game/:id', validate_gid, function(req, res) {
    var game_id = req.params.id;
    res.status(200).json(games[game_id]);
});

// DELETE game
// TODO: remove and add functionality for server to remove stale
// or unfinished games and archive completed games
// (clients shouldn't be deleting games, this is just for testing)
app.delete('/game/:id', validate_gid, function(req, res) {
    var game_id = req.params.id;
    delete games[game_id];
    res.sendStatus(200);
    console.log("game %s deleted", game_id);
});

/*  
    POST player to game
    similar to POST /game, add username, device, etc.?

    params:
    {
        name: "",
        username: "",
    }
*/
app.post('/game/:id/join', validate_gid, validate_join_game, function(req, res) {
    var game_id = req.params.id;
    var player_type = req.body.player_type;
    var game = games[game_id];
    if (!game.player2) {
        player2_id = gen_id();
        game.player2 = create_player(player_type, 'b');
        game.result = "*";
        res.status(200).json(game);
        console.log("player %s joined game %s", player2_id, game.id);
        return;
    }

    res.status(404).json(err.GAME_FULL);
});

// POST game result if game over
app.post('/game/:id/game-over', validate_gid, function(req, res) {
    console.log("result: " + JSON.stringify(req.body));
    games[req.params.id].result = req.body.gameResult;
    res.status(200).json({error: "game is over"});
    return;
});

// GET check if game over
app.get('/game/:id/game-over', validate_gid, function(req, res) {
    var game_id = req.params.id;
    res.status(200).json({game_over: games[game_id].game.game_over(), game_result: games[game_id].result});
});

// GET game result (win, draw, etc.)
app.get('/game/:id/result', validate_gid, function(req, res) {
    var game_id = req.params.id;
    var result = games[game_id].result ? games[game_id].result : null;
    res.status(200).json({result: result});
});

// GET player object of player who's turn it is
app.get('/game/:id/turn', validate_gid, validate_two_players, function(req, res) {
    var game_id = req.params.id;

    var chess = games[game_id].game;
    var player1 = games[game_id].player1;
    var player2 = games[game_id].player2;
    var turn = player1;
    if (player2.color === chess.turn())
        turn = player2;
    res.status(200).json(turn);
});

// GET last move (in long algebraic notation)
app.get('/game/:id/last-move', validate_gid, function(req, res) {
    var game_id = req.params.id;
    var history = games[game_id].game.history({verbose: true});

    if (history.length == 0) {
        res.status(200).json(err.NO_MOVES);
        return;
    }

    var last_move = history[history.length-1];
    augment_move(last_move);
    res.status(200).json(last_move);
});

// GET game fen
app.get('/game/:id/fen', validate_gid, function(req, res) {
    var game_id = req.params.id;
    res.status(200).json({fen: games[game_id].game.fen()});
});

// POST move by player to game
// post body should contain json move
app.post('/game/:id/player/:pid/move', validate_gid, validate_pid, 
         validate_two_players, validate_move, function(req, res) {
    var game_id = req.params.id;
    var player_id = req.params.pid;

    console.log(req.body.move);
    
    var chess =   games[game_id].game;
    var player1 = games[game_id].player1;
    var player2 = games[game_id].player2;
    var color = player1.id === player_id ? player1.color : player2.color;

    if (chess.game_over()) {
        res.status(200).json(err.GAME_OVER);
        return;
    }

    if (chess.turn() == color) {
        var move = req.body.move;
        var promotion = req.body.promotion;
        if (promotion)
            move = move + promotion.toLowerCase();
        var move = chess.move(req.body.move, {sloppy: true}); // need sloppy for algebraic notation
        process_end_game(games[game_id]);
        if (move) {
            augment_move(move, games[game_id]);
            res.status(200).json({game: games[game_id], move: move}); // send back move
            games[game_id].last_move_time = Date.now();
            console.log(chess.ascii());
            return;
        }
        res.status(200).json(err.INVALID_MOVE);
        return;
    }

    res.status(200).json(err.NOT_YOUR_TURN);
});

// GET best move for player in game
app.get('/game/:id/player/:pid/bestmove', validate_gid, validate_pid, 
        validate_two_players, function(req, res) {
    var game_id = req.params.id;
    var player_id = req.params.pid;

    var chess = games[game_id].game;
    var player1 = games[game_id].player1;
    var player2 = games[game_id].player2;
    var color = player1.id === player_id ? player1.color : player2.color;
    if (chess.turn() == color) {
        var moves = chess.moves({verbose:true});
        var moves_dict = {};
        for (i=0; i< moves.length; i++) {
            moves_dict[moves[i].from + moves[i].to] = moves[i];
        }
        stockfish.bestmove(chess.fen(), 20, function(best_move) {
            var promotion;
            if (best_move && best_move.length == 5) {
                promotion = best_move.charAt(4).toLowerCase();
                best_move = best_move.slice(0,4);
            }
            if (!moves_dict[best_move]) {
                res.status(404).json(err.NO_MOVES);
                return;
            }
            augment_move(moves_dict[best_move], chess);
            moves_dict[best_move].promotion = promotion;
            res.status(200).json(moves_dict[best_move]);
        });

        return;
    } else { // if ( end turn situation) 
        console.log("Chess turn not a color: " + chess.turn());
        res.status(404).json(err.NOT_YOUR_TURN);
    }

    res.status(404).json(err.NOT_YOUR_TURN);
});

// GET is it this players turn?
app.get('/game/:id/player/:pid/turn', validate_gid, validate_pid, 
        validate_two_players, function(req, res) {
    var game_id = req.params.id;
    var player_id = req.params.pid;

    var chess = games[game_id].game;
    var player1 = games[game_id].player1;
    var player2 = games[game_id].player2;
    var color = player1.id === player_id ? player1.color : player2.color;
    if (chess.turn() == color) {
        res.status(200).json({turn: true});
        return;
    }

    res.status(200).json({turn: false});
});

/* // not yet
function find_match() {
    for (var id in games) {
        if (!games[id].hasOwnProperty('player2') && games[id].hasOwnProperty('waiting_for') && games[id].waiting_for === opponent_type) {
            if (opponent_type === 'ai')
                return create_player('ai', 'b');
        }
    }
}
*/
app.post('/test', function(req, res, next) {
    console.log(req.body);
    if(req.body.this) {
        res.send(200);    
    } else {
        res.send(300);
    }
    
})
//-----------------------------------------------
// /games
//-----------------------------------------------

// GET games
app.get('/games', function(req, res) {
    var all_games = [];
    for (var id in games) {
        all_games.push(games[id]);
    }
    res.status(200).json(all_games);
});

// GET games currently being played
app.get('/games/in-progress', function(req, res) {
    var games_in_play = [];
    for (var id in games) {
        if (games[id].result === IN_PROGRESS)
          games_in_play.push(games[id]);
    }
    res.status(200).json(games_in_play);
});

// GET games that resulted in checkmate
app.get('/games/in-checkmate', function(req, res) {
    var games_won = [];
    for (var id in games) {
        if (games[id].result === WHITE_WIN || games[id].result === BLACK_WIN)
          games_won.push(games[id]);
    }
    res.status(200).json(games_won);
});

// GET games that resulted in draw
app.get('/games/in-draw', function(req, res) {
    var games_draw = [];
    for (var id in games) {
        if (games[id].result === DRAW)
          games_draw.push(games[id]);
    }
    res.status(200).json(games_draw);
});

// GET games-needing-opponent
app.get('/games/needing-opponent', function(req, res) {
    var games_needing_opponent = [];
    for (var id in games) {
        if (!games[id].hasOwnProperty('player2')) {
            games_needing_opponent.push(games[id]);
        }
    }
    res.status(200).json(games_needing_opponent);
});

// iterator version of GET games-needing-opponent.
// resource constrained clients can use this to get only one game 
// at a time by iterating through :idx until getting an error
app.get('/games/needing-opponent/:idx', function(req, res) {
    var idx = parseInt(req.params.idx, 10);
    var games_needing_opponent = [];
    for (var id in games) {
        if (!games[id].hasOwnProperty('player2')) {
            games_needing_opponent.push(games[id]);
        }
    }
    if (!Number.isNaN(idx) && games_needing_opponent.length > idx) {
        res.status(200).json(games_needing_opponent[idx]);
    }
    else {
        res.status(404).json(err.GAME_NOT_FOUND);
    }
});


//-----------------------------------------------
// HELPER FUNCTIONS
//-----------------------------------------------

var err = {
    GAME_FULL: {err_code: 27, err_msg: "two players already playing"},
    GAME_NOT_FOUND: {err_code: 28, err_msg: "game not found"},
    GAME_OVER: {err_code: 29, err_msg: "game is over"},

    NEED_TWO_PLAYERS: {err_code: 56, err_msg: "need two players"},
    PLAYER_NOT_IN_GAME: {err_code: 57, err_msg: "player not in game"},
    PLAYER_TYPE_REQURIED: {err_code: 58, err_msg: "player type required"},
    NOT_YOUR_TURN: {err_code: 59, err_msg: "not your turn"},

    MOVE_REQUIRED: {err_code: 97, err_msg: "move required"},
    NO_MOVES: {err_code: 98, err_msg: "no moves"},
    INVALID_MOVE: {err_code: 99, err_msg: "invalid move"}
};

String.prototype.format = function() {
  var a = this;
  for (k in arguments) {
    a = a.replace("{" + k + "}", arguments[k])
  }
  return a
}

// use fen notation rather than return whole chess object
function replacer(key, value) {
    if (key == "game") {
        if(value.fen) {
            return value.fen();
        }
    }
    return value;
}

function console_log(message) {
    var timestamp = (new Date()).toISOString();
    console.log("[%s] %s", timestamp, message);
}

// helper function to generate ids
// probably need to use key based on unique device id (MAC, IP, etc.)
// in reality this is not for security but rather uniqeness
function gen_id() {
    var key = "You're a wizard Harry...";
    var now  = Date.now().valueOf().toString();
    var rand = Math.random().toString();
    var id = crypto.createHmac('sha1', key).update(now + rand).digest('hex');
    return id;
}

function process_end_game(game) {
    var chess = game.game;
    if (chess.game_over()) {
        if (chess.in_checkmate()) {
            game.result = chess.turn() === 'w' ? BLACK_WIN : WHITE_WIN;
        } else if (chess.in_draw() || chess.in_stalemate() || chess.in_threefold_repetition()) {
            game.result = DRAW; // draw (pgn)
        }
    }
}

function augment_move(move, game) {
    if (!move)
        return;

    if (move.flags.includes('k')) { // kingside castling
        move.extra_from = (move.color === 'w') ? 'h1' : 'h8';
        move.extra_to   = (move.color === 'w') ? 'f1' : 'f8';
    } else if (move.flags.includes('q')) { // queenside castling
        move.extra_from = (move.color === 'w') ? 'a1' : 'a8';
        move.extra_to = (move.color === 'w') ? 'd1' : 'd8';
    } else if (move.flags.includes('e')) { // en passant capture
        move.en_passant = game.history()[game.history().length-2];
    }else if (move.flags.includes('p')) { // pawn promotion
        move.promotion = 'q'
    }
    move.move = move.from + move.to; // add long alebraic move
    if (move.extra_from && move.extra_to) {
        move.extra_move = move.extra_from + move.extra_to
    }
}

function create_player(player_type, color, player_name) {
    if (player_type === 'ai') {
        return {id: gen_id(), color: color, type: 'ai', name: player_name};
    }
    return {id: gen_id(), color: color, type: 'human', name: player_name}; // else create human
}

function valid_game(game_id) {
    if (game_id && games[game_id])
        return true;
    return false;
}

function valid_player(game_id, player_id) {
    if (valid_game(game_id)) {
        var player1 = games[game_id].player1;
        var player2 = games[game_id].player2;
        if ((player1 && player_id === player1.id) || 
            (player2 && player_id === player2.id)) {
            return true;
        }
    }
    return false;
}

function both_players_ready(game_id) {
    var player1 = games[game_id].player1;
    var player2 = games[game_id].player2;
    if (player1 && player2) {
        return true;
    }
    return false;
}

//-----------------------------------------------
// VALIDATORS (middleware)
//-----------------------------------------------

function validate_two_players(req, res, next) {
    var game_id = req.params.id;
    if (!both_players_ready(game_id)) {
        res.status(200).json(err.NEED_TWO_PLAYERS);
        next('route');
        return;
    }
    next();
}

function validate_pid(req, res, next) {
    var game_id = req.params.id;
    var player_id = req.params.pid;
    if (!valid_player(game_id, player_id)) {
        res.status(404).json(err.PLAYER_NOT_IN_GAME);
        next('route');
        return;
    }
    next();
}

function validate_gid(req, res, next) {
    var game_id = req.params.id;
    if (!valid_game(game_id)) {
        res.status(404).json(err.GAME_NOT_FOUND);
        next('route');
        return;
    }
    next();
}

function validate_move(req, res, next) {
    if (!req.body.move) {
        res.status(200).json(err.MOVE_REQUIRED);
        next('route');
        return;
    }
    next();
}

function validate_create_game(req, res, next) {
    if (!req.body.player_type) {
        res.status(200).json(err.PLAYER_TYPE_REQURIED);
        next('route');
        return;
    }
    next();
}

// same as validate_create_game (for now)
function validate_join_game(req, res, next) {
    validate_create_game(req, res, next);
}

serialize = function(obj) {
  var str = [];
  for(var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}

//-----------------------------------------------
// TESTING
//-----------------------------------------------

// register device, 
app.get('/reg', function(req, res) {
    if (players.length < 2) {
        var player_id = gen_id();
        res.status(200).json({id: player_id});
        players.push(player_id);
        console.log("player %s has joined", player_id);
    } else {
        res.status(404).json(err.GAME_FULL);
    }
});

//-----------------------------------------------
// APP START
//-----------------------------------------------

var port = process.env.PORT || 30300; 
var args = process.argv.slice(2); // throw away 'node' and program arg
if (args.length >= 1)
    port = parseInt(args[0])

// start server
var server = app.listen(port, "0.0.0.0", function() {
    var host = server.address().address;
    var port = server.address().port;
    
    console_log("rest api server listening at http://{0}:{1}".format(host, port));
});

module.exports = server;

/*
var telnet_server = net.createServer(function(socket) {
	socket.write('Echo server\r\n');
	socket.pipe(socket);
});

telnet_server.listen(8080, '127.0.0.1');
console.log("telnet server listenting at 127.0.0.1 at port 8080");
*/
