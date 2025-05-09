import React, { useState, useEffect } from "react";
import "../styles/scoreboard.css";

const Scoreboard = ({ socket }) => {
  const [players, setPlayers] = useState([]);
  const [currentUser, setCurrentUser] = useState("");

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      
      if (data.type === "connection_established") {
        // 從連接訊息中獲取自己的用戶名
        const match = data.message.match(/歡迎\s+(.+?)!/);
        if (match && match[1]) {
          setCurrentUser(match[1].trim());
        }
      }
      
      if (data.type === "room_info") {
        if (data.players && data.players.length > 0) {
          // 如果是準備狀態，所有玩家都應被視為已準備
          const updatedPlayers = data.players.map(player => ({
            ...player,
            // 根據玩家的準備狀態或賦予默認值
            is_ready: player.is_ready !== undefined ? player.is_ready : true
          }));
          setPlayers(updatedPlayers);
        }
      }
      
      if (data.type === "player_ready_state") {
        // 接收玩家準備狀態更新
        setPlayers(prevPlayers => {
          return prevPlayers.map(player => {
            if (player.username === data.username) {
              return { ...player, is_ready: data.is_ready };
            }
            return player;
          });
        });
      }
      
      if (data.type === "update_score") {
        // 接收分數更新
        setPlayers(prevPlayers => {
          return prevPlayers.map(player => {
            if (player.username === data.username) {
              return { ...player, score: data.score };
            }
            return player;
          });
        });
      }
    };

    socket.addEventListener("message", handleMessage);
    
    // 如果沒有獲取到房間信息，主動請求一次
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "request_room_info" }));
    }
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  // 如果沒有玩家資料，顯示默認狀態
  const displayPlayers = players.length > 0 ? players : [
    { username: "等待玩家加入...", score: 0, is_ready: false }
  ];

  return (
    <div className="scoreboard">
      <h2>記分板</h2>
      <div className="scores-container">
        <table>
          <thead>
            <tr>
              <th>玩家</th>
              <th>分數</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            {displayPlayers.map((player, index) => (
              <tr key={index} className={player.username === currentUser ? "current-player" : ""}>
                <td>{player.username}</td>
                <td>{player.score || 0}</td>
                <td className={player.is_ready ? "ready" : "not-ready"}>
                  {player.is_ready ? "已準備" : "未準備"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Scoreboard;