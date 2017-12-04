var spawn = require('child_process').spawn;
var stockfishnpm = require('stockfish');

function asWorker(fen, level, cb) {
    var engine = stockfishnpm();
     engine.onmessage = function(data) {
        best_move = "bestmove";
        if (data.toString().includes(best_move)) {
            lines = data.toString().split('\n');
            for (i=0; i<lines.length; i++) {
                if (lines[i].includes(best_move)) {
                    words = lines[i].split(' ');
                    console.log("got best move %s, killing stockfish instance", words[words.indexOf(best_move)+1]);
                    cb(words[words.indexOf(best_move)+1]);
                }
            }
        }
    }
            
    engine.postMessage("uci\n");
    engine.postMessage("ucinewgame\n");
    engine.postMessage("setoption name Skill Level value " + level + "\n");
    engine.postMessage("position fen " + fen + "\n");
    engine.postMessage("go\n");
}

function asSpawn(fen, level, cb) {
    var stockfish = spawn('stockfish');

    stockfish.write = function(str) {
        this.stdin.write(str + "\n");
    };
    
    stockfish.stdout.on('data', (data, blah) => {
        best_move = "bestmove";
        if (data.toString().includes(best_move)) {
            lines = data.toString().split('\n');
            for (i=0; i<lines.length; i++) {
                if (lines[i].includes(best_move)) {
                    words = lines[i].split(' ');
                    console.log("got best move %s, killing stockfish instance", words[words.indexOf(best_move)+1]);
                    stockfish.kill('SIGINT');
                    cb(words[words.indexOf(best_move)+1]);
                }
            }
        }
    });
    
    stockfish.stderr.on('data', (data) => {
//        console.log("%s", data);
    });
    
    stockfish.on('close', (code) => {
//      console.log("child process exited with code %s", code);
    });

    stockfish.write("uci");
    stockfish.write("ucinewgame");
    stockfish.write("setoption name Skill Level value " + level);
    stockfish.write("position fen " + fen);
    stockfish.write("go");
}


exports.bestmove = asWorker;
