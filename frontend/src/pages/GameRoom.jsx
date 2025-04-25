import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameStatus from '../components/GameStatus';
import GameBoard from '../components/GameBoard';
import PlayerHand from '../components/PlayerHand';
import ChatBox from '../components/ChatBox';
import '../styles/game_room.css';

const GameRoom = () => {
  const { roomName } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    if (!roomName) return;
    
    // 獲取房間 ID 用於刪除操作
    fetch(`http://127.0.0.1:8000/api/rooms/?name=${roomName}`)
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setRoomId(data[0].id);
        }
      })
      .catch(err => console.error("獲取房間ID失敗:", err));
    
    // WebSocket 連接
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = '127.0.0.1:8000';
    const wsUrl = `${protocol}//${host}/ws/game/${roomName}/`;
    
    console.log(`嘗試連接WebSocket: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket連接成功');
      setConnected(true);
      setConnectionError(null);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket錯誤:', error);
      setConnectionError('連接到伺服器時發生錯誤，請確認後端伺服器是否已使用daphne正確啟動');
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket連接已關閉: 代碼 ${event.code}, 原因: ${event.reason}`);
      setConnected(false);
      if (!connectionError) {
        setConnectionError('與伺服器的連接已關閉，請刷新頁面重試');
      }
    };
    
    setSocket(ws);
    
    return () => {
      if (ws && ws.readyState <= 1) {
        ws.close();
      }
    };
  }, [roomName]);

  const handleDeleteRoom = () => {
    if (!roomId) {
      alert("無法獲取房間ID，刪除失敗");
      return;
    }

    if (confirm(`確定要刪除房間 "${roomName}" 嗎？`)) {
      fetch(`http://127.0.0.1:8000/api/rooms/${roomId}/`, {
        method: 'DELETE',
      })
        .then(res => {
          if (res.ok) {
            alert("房間已成功刪除");
            navigate('/');
          } else {
            throw new Error("刪除房間失敗");
          }
        })
        .catch(err => {
          console.error("刪除房間時出錯:", err);
          alert("刪除房間失敗，請稍後再試");
        });
    }
  };

  return (
    <div className="container">
      <div className="room-header">
        <h1>Take 6! 線上牛頭王 - 遊戲房間: {roomName}</h1>
        <div className="room-actions">
          <button onClick={() => navigate('/')} className="back-btn">返回大廳</button>
          <button onClick={handleDeleteRoom} className="delete-room-btn">刪除房間</button>
        </div>
      </div>
      
      {connected ? (
        <>
          <GameStatus socket={socket} />
          <GameBoard socket={socket} />
          <PlayerHand socket={socket} />
          <div className="game-controls">
            <button 
              onClick={() => socket?.send(JSON.stringify({ type: "start_game" }))}
              className="start-game-btn"
            >
              開始遊戲
            </button>
          </div>
          <ChatBox socket={socket} />
        </>
      ) : (
        <div className="connection-status">
          <p>連接中... 請稍候</p>
          {connectionError && (
            <div className="connection-error">
              <p>{connectionError}</p>
              <p>請確認以下事項：</p>
              <ol>
                <li>Django 後端伺服器是否已啟動（使用 daphne 命令）</li>
                <li>伺服器是否運行在 127.0.0.1:8000 上</li>
                <li>伺服器的 CORS 設定是否正確</li>
              </ol>
              <button onClick={() => window.location.reload()} className="retry-btn">
                重試連接
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameRoom;
