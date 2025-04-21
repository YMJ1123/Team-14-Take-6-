import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GameStatus from '../components/GameStatus';
import GameBoard from '../components/GameBoard';
import PlayerHand from '../components/PlayerHand';
import ChatBox from '../components/ChatBox';
import '../styles/game_room.css';

const GameRoom = ({ roomName }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!roomName) return;
    const ws_scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${ws_scheme}://${window.location.host}/ws/game/${roomName}/`);
    setSocket(ws);
    return () => ws.close();
  }, [roomName]);

  return (
    <div className="container">
      <h1>Take 6! 線上牛頭王 - 遊戲房間: {roomName}</h1>
      <GameStatus socket={socket} />
      <GameBoard socket={socket} />
      <PlayerHand socket={socket} />
      <button onClick={() => socket?.send(JSON.stringify({ type: "start_game" }))}>
        開始遊戲
      </button>
      <ChatBox socket={socket} />
    </div>
  );
};

export default GameRoom;
