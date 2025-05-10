import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameStatus from '../components/GameStatus';
import GameBoard from '../components/GameBoard';
import ChatBox from '../components/ChatBox';
import Scoreboard from '../components/Scoreboard';
import RemainingCards from '../components/RemainingCards';
import '../styles/game_room.css';

const GameRoom = () => {
  const { roomName } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isPrepared, setIsPrepared] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const backgroundMusicRef = useRef(null);
  const gameStartSoundRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!roomName) return;
    
    // Get room ID for delete operation
    fetch(`http://127.0.0.1:8000/api/rooms/?name=${roomName}`)
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setRoomId(data[0].id);
        }
      })
      .catch(err => console.error("Failed to get room ID:", err));
    
    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = '127.0.0.1:8000';
    const wsUrl = `${protocol}//${host}/ws/game/${roomName}/`;
    
    console.log(`Attempting to connect to WebSocket: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connection successful');
      setConnected(true);
      setConnectionError(null);
      
      // Auto-play background music
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.volume = 0.3;
        backgroundMusicRef.current.loop = true;
        
        const playPromise = backgroundMusicRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsMusicPlaying(true);
          }).catch(error => {
            console.log("Autoplay blocked, requires user interaction:", error);
            setIsMusicPlaying(false);
          });
        }
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionError('Error connecting to server, please check if the backend server is running correctly with daphne');
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket connection closed: Code ${event.code}, Reason: ${event.reason}`);
      setConnected(false);
      if (!connectionError) {
        setConnectionError('Connection to server closed, please refresh to try again');
      }
    };
    
    // 可能要改變IsGameStarted的狀態 hyc
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "game_started") {
        setIsGameStarted(true);
      }
      if (data.type === "room_info" && data.players) {
        setPlayerCount(data.players.length);
      }
    };
    
    setSocket(ws);
    
    return () => {
      if (ws && ws.readyState <= 1) {
        ws.close();
      }
      
      // Stop all music when leaving page
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
      
      if (gameStartSoundRef.current) {
        gameStartSoundRef.current.pause();
        gameStartSoundRef.current.currentTime = 0;
      }
    };
  }, [roomName]);

  const handleDeleteRoom = () => {
    if (!roomId) {
      alert("Unable to get room ID, deletion failed");
      return;
    }

    if (confirm(`Are you sure you want to delete room "${roomName}"?`)) {
      fetch(`http://127.0.0.1:8000/api/rooms/${roomId}/`, {
        method: 'DELETE',
      })
        .then(res => {
          if (res.ok) {
            alert("Room successfully deleted");
            navigate('/');
          } else {
            throw new Error("Failed to delete room");
          }
        })
        .catch(err => {
          console.error("Error deleting room:", err);
          alert("Failed to delete room, please try again later");
        });
    }
  };

  const handlePrepare = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "player_ready", is_ready: true }));
      setIsPrepared(true);
    } else {
      console.error("WebSocket is not connected.");
    }
    
    // Stop background music and switch to game start music
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
    
    // Play game start music on loop
    if (gameStartSoundRef.current) {
      gameStartSoundRef.current.volume = 0.5;
      gameStartSoundRef.current.loop = true;
      gameStartSoundRef.current.play().then(() => {
        setIsMusicPlaying(true);
      }).catch(error => {
        console.log("Failed to play audio:", error);
        setIsMusicPlaying(false);
      });
    }
  };

  const handleStartGame = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "start_game" }));
    }
  };

  // 新增遊戲開始的處理函數
  const handleGameStarted = (data) => {
    console.log("Game started with data:", data);
    setIsGameStarted(true);
    // TODO: 在這裡添加遊戲開始後的初始化邏輯
  };

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("GameRoom received message:", data);

      if (data.type === "connection_established") {
        const match = data.message.match(/歡迎\s+(.+?)!/);
        if (match && match[1]) {
          setCurrentUser(match[1].trim());
        }
      }

      if (data.type === "user_notification") {
        setMessages(prev => [...prev, { username: data.username, message: data.message }]);
      }

      if (data.type === "chat_message") {
        setMessages(prev => [...prev, { username: data.username, message: data.message }]);
      }

      if (data.type === "game_started") {
        handleGameStarted(data);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  const toggleMusic = () => {
    if (isMusicPlaying) {
      // Stop music if playing
      if (isPrepared && gameStartSoundRef.current) {
        gameStartSoundRef.current.pause();
        gameStartSoundRef.current.currentTime = 0;
      } else if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
      setIsMusicPlaying(false);
    } else {
      // Play music if stopped
      if (isPrepared && gameStartSoundRef.current) {
        gameStartSoundRef.current.play().then(() => {
          setIsMusicPlaying(true);
        });
      } else if (backgroundMusicRef.current) {
        backgroundMusicRef.current.play().then(() => {
          setIsMusicPlaying(true);
        });
      }
    }
  };

  return (
    <div className="container">
      <div className="room-header">
        <h1>Take 6! 線上牛頭王 - 遊戲房間: {roomName}</h1>
        <div className="room-actions">
          <button onClick={toggleMusic} className={isMusicPlaying ? "music-btn playing" : "music-btn"}>
            {isMusicPlaying ? "停止音樂" : "播放音樂"}
          </button>
          <button onClick={() => navigate('/')} className="back-btn">返回大廳</button>
          <button onClick={handleDeleteRoom} className="delete-room-btn">刪除房間</button>
        </div>
      </div>
      
      {/* 音頻元素 */}
      <audio ref={backgroundMusicRef} src="/sounds/background-music.mp3"></audio>
      <audio ref={gameStartSoundRef} src="/sounds/game-start.mp3"></audio>
      
      {connected ? (
        <>
          <GameStatus socket={socket} />
          
          {isPrepared && (
            <>
              <Scoreboard socket={socket} />
              
              {/* 整合我的手牌到遊戲牌桌內 */}
              <GameBoard 
                socket={socket} 
                isPrepared={isPrepared} 
                isGameStarted={isGameStarted} 
              />
              
              {/* 剩餘牌數顯示 */}
              {!isGameStarted && <RemainingCards 
                playerCount={playerCount} 
                isGameStarted={isGameStarted}
              />}
            </>
          )}
          
          <div className="game-controls">
            {!isPrepared ? (
              <button 
                onClick={handlePrepare}
                className="prepare-btn"
              >
                準備
              </button>
            ) : !isGameStarted ? (
              <button 
                onClick={handleStartGame}
                className="start-game-btn"
              >
                遊戲開始
              </button>
            ) : null}
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
