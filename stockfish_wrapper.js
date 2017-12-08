var spawn = require('child_process').spawn;

exports.bestmove = function(fen, level, cb) {
    var stockfish = spawn('stockfish');

    stockfish.write = function(str) {
        this.stdin.write(str + "\n");
    };
    
    stockfish.stdout.on('data', (data, blah) => {
        best_move = "bestmove";
        if (data.toString().includes(best_move)) {
            lines = data.toString().split('\n');
            console.log(lines);
            for (i=0; i<lines.length; i++) {
                if (lines[i].includes(best_move)) {
                    words = lines[i].split(' ');
                    console.log("%s", fen);
                    for (j=0; j<words.length; j++) {
                        console.log("%s", words[j]);
                    }
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
    stockfish.write("setoption name Contempt value " + 100);
    stockfish.write("position fen " + fen);
    stockfish.write("go");
}
