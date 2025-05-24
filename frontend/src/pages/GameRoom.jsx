import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameStatus from '../components/GameStatus';
import GameBoard from '../components/GameBoard';
import ChatBox from '../components/ChatBox';
import Scoreboard from '../components/Scoreboard';
import RemainingCards from '../components/RemainingCards';
import { useAuth } from '../components/AuthProvider';
import '../styles/game_room.css';

function getCookie(name) {
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='))
    ?.split('=')[1];
  return cookieValue;
}

const GameRoom = () => {
  const { roomName } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  // Add authentication check and redirect
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/?requireLogin=true');
    }
  }, [isAuthenticated, navigate]);
  
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isPrepared, setIsPrepared] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [readyPlayerCount, setReadyPlayerCount] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const backgroundMusicRef = useRef(null);
  const gameStartSoundRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 5;
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connectWebSocket = async () => {
    if (!roomName) return null;
    
    // 先獲取用戶資訊
    try {
      const response = await fetch('https://team-14-take-6.onrender.com/api/auth/current_user/', {
        credentials: 'include'
      });
      const userData = await response.json();
      
      console.log("User data from API:", userData);  // 調試輸出
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = 'team-14-take-6.onrender.com';
      let wsUrl = `${protocol}//${host}/ws/game/${roomName}/`;
      
      // 檢查是否已登入，有兩種可能的API響應格式
      let username = null;
      
      // 第一種格式：user 物件包含完整的用戶資訊
      if (userData && userData.user && userData.user.username) {
        username = userData.user.username;
      } 
      // 第二種格式：直接包含 username
      else if (userData && userData.username) {
        username = userData.username;
      }
      
      if (username) {
        wsUrl += `?username=${encodeURIComponent(username)}`;
        console.log(`已找到用戶名：${username}，準備建立連接: ${wsUrl}`);
      } else if (isAuthenticated && user && user.username) {
        // 從 AuthContext 獲取用戶名
        wsUrl += `?username=${encodeURIComponent(user.username)}`;
        console.log(`從 Context 獲取用戶名：${user.username}，準備建立連接: ${wsUrl}`);
      } else {
        console.error('找不到有效的用戶名，無法建立連接', { userData, isAuthenticated, user });
        setConnectionError('請先登入後再進入遊戲房間');
        // Redirect to home page if not authenticated
        navigate('/?requireLogin=true');
        return null;
      }
      
      console.log(`Attempting to connect to WebSocket: ${wsUrl}`);
      console.log(`Authentication status: ${isAuthenticated ? 'Logged in as ' + user?.username : 'Guest mode'}`);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connection successful');
        setConnected(true);
        setConnectionError(null);
        setReconnectAttempts(0);
        
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
        setConnectionError('連接到伺服器時出錯，請確認您已登入並且後端伺服器正在運行');
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket connection closed: Code ${event.code}, Reason: ${event.reason}`);
        setConnected(false);
        
        // 嘗試重新連接，除非已經達到最大重試次數
        if (reconnectAttempts < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          console.log(`Attempting to reconnect in ${timeout/1000} seconds...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            const newWs = connectWebSocket();
            if (newWs) setSocket(newWs);
          }, timeout);
        } else {
          setConnectionError('Connection to server lost. Please refresh the page to try again.');
        }
      };
      
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log("Received WebSocket message:", data);
          
          if (data.type === "game_started") {
            setIsGameStarted(true);
          }
          if (data.type === "room_info" && data.players) {
            console.log("收到房間信息，玩家列表:", data.players);
            setPlayerCount(data.players.length);
            // 計算已準備的玩家數量
            const readyCount = data.players.filter(player => player.is_ready).length;
            setReadyPlayerCount(readyCount);
          }
          if (data.type === "connection_established") {
            console.log("連接建立消息:", data);
            // 直接使用消息中的 playerId
            if (data.playerId) {
              console.log(`獲得玩家ID: ${data.playerId}`);
            }
            
            // 從歡迎消息中提取用戶名
            if (data.message) {
              const match = data.message.match(/歡迎\s+(.+?)!/);
              if (match && match[1]) {
                setCurrentUser(match[1].trim());
                console.log(`設置當前用戶為: ${match[1].trim()}`);
              }
            }
          }
          if (data.type === "error") {
            console.error("從服務器收到錯誤:", data.message);
            setConnectionError(data.message);
          }
          if (data.type === "user_notification") {
            console.log("用戶通知:", data);
            setMessages(prev => [...prev, { username: data.username, message: data.message }]);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      return ws;
    } catch (error) {
      console.error('Error fetching user data:', error);
      setConnectionError(`獲取用戶資訊時出錯: ${error.message}`);
      return null;
    }
  };

  useEffect(() => {
    if (!roomName) return;
    
    // Get room ID for delete operation
    fetch(`https://team-14-take-6.onrender.com/api/rooms/?name=${roomName}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setRoomId(data[0].id);
        }
      })
      .catch(err => console.error("Failed to get room ID:", err));
    
    // 初始化 WebSocket 連接
    connectWebSocket().then(ws => {
      if (ws) setSocket(ws);
    });
    
    return () => {
      // 清理重連計時器
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // 關閉 WebSocket 連接
      if (socket && socket.readyState <= 1) {
        socket.close(1000, "Component unmounting");
      }
      
      // 停止所有音樂
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
      
      if (gameStartSoundRef.current) {
        gameStartSoundRef.current.pause();
        gameStartSoundRef.current.currentTime = 0;
      }
    };
  }, [roomName, reconnectAttempts]);

  const handleDeleteRoom = () => {
    if (!roomId) {
      alert("無法獲取房間ID，刪除失敗");
      return;
    }

    if (confirm(`確定要刪除「${roomName}」房間嗎？`)) {
      fetch(`https://team-14-take-6.onrender.com/api/rooms/${roomId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
        },
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
          console.error("刪除房間出錯:", err);
          alert("刪除房間失敗，請稍後再試");
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
    if (playerCount < 2) {
      alert("至少需要2位玩家才能開始遊戲！");
      return;
    }
    
    if (readyPlayerCount < 2) {
      alert("至少需要2位玩家準備好才能開始遊戲！");
      return;
    }
    
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
      
      // 處理檢查管理員的回覆
      if (data.type === "admin_check") {
        console.log("Received admin check:", data);
        setIsAdmin(data.is_admin);
      }
      
      // 處理玩家準備狀態更新
      if (data.type === "player_ready_state") {
        // 當收到準備狀態更新時，請求最新的房間信息
        socket.send(JSON.stringify({
          type: "get_room_info"
        }));
        
        // 如果消息中包含用戶ID和管理員信息，且與當前用戶相關，則更新管理員狀態
        if (data.user_id !== undefined && data.is_admin !== undefined) {
          if (data.username === currentUser) {
            setIsAdmin(data.is_admin);
          }
        }
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, currentUser]);

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
        <h1>
          Take 6! 線上牛頭王 - 遊戲房間: {roomName}
          {isAdmin && <span className="admin-badge" title="你是房主">👑</span>}
        </h1>
        <div className="user-status">
          {isAuthenticated ? 
            <span className="logged-in-status">已登入: {user.username}</span> : 
            <span className="guest-status">訪客模式: {currentUser}</span>
          }
        </div>
        <div className="room-actions">
          <button onClick={toggleMusic} className={isMusicPlaying ? "music-btn playing" : "music-btn"}>
            {isMusicPlaying ? "停止音樂" : "播放音樂"}
          </button>
          <button onClick={() => navigate('/')} className="back-btn">返回大廳</button>
          {isAdmin && <button onClick={handleDeleteRoom} className="delete-room-btn">刪除房間</button>}
        </div>
      </div>
      
      {/* 音頻元素 */}
      <audio ref={backgroundMusicRef} src="/sounds/background-music.mp3"></audio>
      <audio ref={gameStartSoundRef} src="/sounds/game-start.mp3"></audio>
      
      {connected ? (
        <>
          <GameStatus socket={socket} />
          <div className="game-controls">
                { !isPrepared ? (
                  <button 
                    onClick={handlePrepare}
                    className="prepare-btn"
                  >
                    準備
                  </button>
                ) : null}
          </div>  

          {isPrepared && (
            <>
              <Scoreboard socket={socket} />
              
              {/* 整合我的手牌到遊戲牌桌內 */}
              <GameBoard 
                socket={socket} 
                isPrepared={isPrepared} 
                isGameStarted={isGameStarted} 
              />
              <div className="game-controls">    
                { !isGameStarted ? (
                  isAdmin && (
                    <button 
                      onClick={handleStartGame}
                      className="start-game-btn"
                      disabled={playerCount < 2 || readyPlayerCount < 2}
                      style={{ 
                        opacity: (playerCount < 2 || readyPlayerCount < 2) ? 0.5 : 1,
                        cursor: (playerCount < 2 || readyPlayerCount < 2) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {playerCount < 2 ? 
                        `等待更多玩家加入 (${playerCount}/2)` : 
                        readyPlayerCount < 2 ? 
                          `等待玩家準備 (${readyPlayerCount}/2)` : 
                          "遊戲開始"}
                    </button>
                  )
                ) : null}
              </div>
              
            </>
          )}          
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
                <li>您已經成功登入（目前用戶：{isAuthenticated ? user?.username : '未登入'}）</li>
                <li>Django 後端伺服器是否已啟動（使用 daphne 命令）</li>
                <li>伺服器是否運行在 team-14-take-6.onrender.com 上</li>
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
