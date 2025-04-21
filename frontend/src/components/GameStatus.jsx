import React, { useState, useEffect } from "react";
import "../styles/game_room.css";

const GameStatus = ({ socket }) => {
  const [players, setPlayers] = useState([]);
  const [statusText, setStatusText] = useState("等待玩家加入...");

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "room_info") {
        setPlayers(data.players);
        if (data.players.length < 2) {
          setStatusText(`等待更多玩家加入 (${data.players.length}/2)`);
        } else {
          setStatusText(`可以開始遊戲 (${data.players.length} 名玩家)`);
        }
      }

      if (data.type === "game_started") {
        setStatusText("遊戲進行中");
      }
    };
  }, [socket]);

  return (
    <div id="gameStatus">
      <h2>遊戲狀態: <span>{statusText}</span></h2>
      <div id="playerList">
        <h3>玩家列表:</h3>
        <ul>
          {players.map(player => (
            <li key={player.username}>
              {player.username}（分數: {player.score}）
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GameStatus;
