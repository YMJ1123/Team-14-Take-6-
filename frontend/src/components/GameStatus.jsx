import React, { useState, useEffect } from "react";
import "../styles/game_room.css";

const GameStatus = ({ socket }) => {
  const [players, setPlayers] = useState([]);
  const [statusText, setStatusText] = useState("等待玩家加入...");

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("收到狀態更新:", data);

      if (data.type === "room_info") {
        console.log("房間信息更新，玩家列表:", data.players);
        setPlayers(data.players || []);
        
        // 更新遊戲狀態文字
        if (data.players && data.players.length < 2) {
          setStatusText(`等待更多玩家加入 (${data.players.length}/2)`);
        } else {
          setStatusText(`可以開始遊戲 (${data.players.length} 名玩家)`);
        }
      }

      if (data.type === "user_notification") {
        console.log("用戶通知:", data.message);
        // 用戶通知顯示在聊天框中，由ChatBox組件處理
      }

      if (data.type === "game_started") {
        setStatusText("遊戲進行中");
      }
    };

    socket.addEventListener("message", handleMessage);
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  return (
    <div id="gameStatus">
      <h2>遊戲狀態: <span>{statusText}</span></h2>
      <div id="playerList">
        <h3>玩家列表:</h3>
        <ul>
          {players && players.length > 0 ? (
            players.map((player, index) => (
              <li key={index}>
                {player.username || player.display_name}
                {!player.username && " (訪客)"}
                （分數: {player.score || 0}）
              </li>
            ))
          ) : (
            <li>目前沒有玩家</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default GameStatus;
