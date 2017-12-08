import requests
import time
import json
import sys

server = 'localhost';
port = '30300';
if len(sys.argv) >= 2:
    server = str(sys.argv[1])
if len(sys.argv) >= 3:
    port = str(sys.argv[2])

server = 'http://' + server + ':' + port
#promo_start ='2kr4/ppp2pp1/2p5/2b2b2/2P1pPPq/1P2P3/PBQPB1p1/RN1K1R2 b - - 3 17'
promo_start = ""


def get_json(req):
    try:
        return req.json()
    except ValueError:
        print("failed to decode json");
        return

def json_print(j):
    print(json.dumps(j, indent=4))
    return

def post_json(url, json_dict):
    headers = {"Content-Type": "application/json"}
    res = requests.post(url, data=json.dumps(json_dict), headers=headers)
    if res.ok:
        return res.json()
    return {}

def make_best_move(gid, pid):
    b = requests.get('{}/game/{}/player/{}/bestmove'.format(server, gid, pid))
    if not b.ok:
        json_print(b.json())
        print("cannot get best move")
        return

    b_json = get_json(b)
    if b_json:
        bestmove = b_json.get('move')
        promotion = b_json.get('promotion')
    else:
        return

#    json_print(b_json)
    print("BEST MOVE ----------")
    print("bestmove={}".format(bestmove))
    print("promotion={}".format(promotion))
    move = {"move": str(bestmove)}
    if promotion:
        move["promotion"] = str(promotion)
    move_res = post_json('{}/game/{}/player/{}/move'.format(server, gid, pid), move)
    if move_res:
        json_print(move_res)
    else:
        print("probably not your turn")
        return

def get_last_move(gid):
    m = requests.get('{}/game/{}/last-move'.format(server, gid))
    if not m.ok:
        json_print(m.json())
        print("cannot get last move")
        return

    m_json = get_json(m)
    if m_json:
        print("LAST MOVE ----------")
        json_print(m_json)
    return

game = {}
game_id = ''
player_id = ''
games = requests.get('{}/games/needing-opponent'.format(server))
if games.ok:
    if not games.json(): # if no game, create it
        game = post_json('{}/game'.format(server), {"player_type":"ai", "start": promo_start, "opponent_type": "ai"})
        if game:
            json_print(game)
            player_id = game['player1']['id']
        else:
            print("game creation failed")
            exit()
    else: # else just get first game for now
        print('game needing opponent found, joining')
        game = games.json()[0]
        r_game = post_json('{}/game/{}/join'.format(server, game['id']), {'player_type':'ai'})
        if r_game:
           game = r_game 
        json_print(game)
        player_id = game['player2']['id']

    game_id = game['id']
    print("game id: {}".format(game_id))
    print("your player id: {}".format(player_id))

    while True:
        game_over = requests.get('{}/game/{}/game-over'.format(server, game_id))
        if game_over.ok and game_over.json().get('game_over'):
            print("game over, printing result and exiting")
            result = requests.get('{}/game/{}/result'.format(server, game_id))
            if result.ok:
                json_print(result.json())
            exit()
        turn = requests.get('{}/game/{}/player/{}/turn'.format(server, game_id, player_id))
        if turn.ok:
            if turn.json().get('turn'):
                get_last_move(game_id);
                make_best_move(game_id, player_id)
        else:
            print(turn.status_code)
            print(turn.reason)
            exit()
        time.sleep(1)
