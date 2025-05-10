import React, { useState, useEffect } from "react";
import "../styles/scoreboard.css";

const Scoreboard = ({ socket }) => {
  const [players, setPlayers] = useState([]);
  const [currentUser, setCurrentUser] = useState("");

  // 請求更新房間信息的函數
  const requestRoomInfo = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "request_room_info" }));
    }
  };

  useEffect(() => {
    if (!socket) return;

    // 設置定時更新（每5秒更新一次）
    const updateInterval = setInterval(requestRoomInfo, 5000);

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("Scoreboard received message:", data);
      
      if (data.type === "connection_established") {
        // 從連接訊息中獲取自己的用戶名
        const match = data.message.match(/歡迎\s+(.+?)!/);
        if (match && match[1]) {
          setCurrentUser(match[1].trim());
        }
        // 連接建立後立即請求房間信息
        requestRoomInfo();
      }
      
      if (data.type === "room_info") {
        console.log("Updating players list:", data.players);
        if (data.players && data.players.length > 0) {
          const updatedPlayers = data.players.map(player => ({
            ...player,
            // 新玩家默認為未準備狀態
            is_ready: player.is_ready === true ? true : false,
            score: player.score || 0
          }));
          setPlayers(updatedPlayers);
        } else {
          setPlayers([]);
        }
      }
      
      if (data.type === "user_notification") {
        // 當有玩家加入或離開時，立即請求更新房間信息
        requestRoomInfo();
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
    requestRoomInfo();
    
    return () => {
      socket.removeEventListener("message", handleMessage);
      clearInterval(updateInterval);
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