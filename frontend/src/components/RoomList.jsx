import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import "../styles/home.css";

const RoomList = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchCounter, setFetchCounter] = useState(0); // 用於追蹤刷新次數

  // 將獲取房間數據的邏輯抽取為一個函數，以便重複使用
  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      // 添加時間戳防止快取
      const timestamp = new Date().getTime();
      
      // 獲取房間列表
      const roomsResponse = await fetch(`http://127.0.0.1:8000/api/rooms/?_=${timestamp}`);
      if (!roomsResponse.ok) {
        throw new Error("無法獲取房間列表");
      }
      const roomsData = await roomsResponse.json();
      
      // 為每個房間獲取玩家數量（嘗試多種方法獲取最準確的數據）
      const roomsWithPlayers = await Promise.all(
        roomsData.map(async (room) => {
          // 使用三種不同的方法獲取玩家數量，然後取最大值
          let playerCount = 0;
          let counts = [];
          
          try {
            // 方法1: 使用專門的玩家數量API端點 (添加時間戳防止快取)
            const playerCountResponse = await fetch(`http://127.0.0.1:8000/api/rooms/${room.id}/player_count/?_=${timestamp}`);
            if (playerCountResponse.ok) {
              const playerCountData = await playerCountResponse.json();
              if (playerCountData.player_count !== undefined) {
                counts.push(playerCountData.player_count);
              }
            }
          } catch (error) {
            console.log(`使用player_count端點獲取房間 ${room.name} 的玩家數量失敗:`, error);
          }
          
          try {
            // 方法2: 檢查WebSocket活躍房間 (添加時間戳防止快取)
            const wsRoomResponse = await fetch(`http://127.0.0.1:8000/api/active_rooms/${room.name}/?_=${timestamp}`);
            if (wsRoomResponse.ok) {
              const wsRoomData = await wsRoomResponse.json();
              if (wsRoomData && wsRoomData.player_count !== undefined) {
                counts.push(wsRoomData.player_count);
              }
            }
          } catch (error) {
            console.log(`使用active_rooms端點獲取房間 ${room.name} 的玩家數量失敗:`, error);
          }
          
          try {
            // 方法3: 從遊戲會話獲取 (添加時間戳防止快取)
            const gameResponse = await fetch(`http://127.0.0.1:8000/api/games/?room=${room.id}&_=${timestamp}`);
            if (gameResponse.ok) {
              const gameData = await gameResponse.json();
              
              if (gameData && gameData.length > 0) {
                // 檢查players數組
                if (gameData[0].players && Array.isArray(gameData[0].players)) {
                  counts.push(gameData[0].players.length);
                }
                
                // 檢查connected_players對象
                if (gameData[0].connected_players) {
                  const connectedCount = Object.keys(gameData[0].connected_players).length;
                  counts.push(connectedCount);
                }
              }
            }
          } catch (error) {
            console.log(`使用games端點獲取房間 ${room.name} 的玩家數量失敗:`, error);
          }
          
          // 如果有獲取到任何數量，取最可能的值（模式）
          if (counts.length > 0) {
            // 找出出現最多次的數值
            const countMap = {};
            let maxCount = 0;
            let mostFrequent = 0;
            
            counts.forEach(count => {
              countMap[count] = (countMap[count] || 0) + 1;
              if (countMap[count] > maxCount) {
                maxCount = countMap[count];
                mostFrequent = count;
              }
            });
            
            playerCount = mostFrequent;
          }
          
          // 確保playerCount至少為0
          return { 
            ...room, 
            playerCount: Math.max(0, playerCount),
            // 儲存每次獲取的原始數據，用於調試
            _debug_counts: counts
          };
        })
      );
      
      // 檢查結果並與前一次獲取的結果比較
      setRooms(prevRooms => {
        // 如果有明顯差異，標記需要再次刷新
        const needsRefresh = roomsWithPlayers.some((newRoom, index) => {
          const oldRoom = prevRooms[index];
          return oldRoom && Math.abs(newRoom.playerCount - oldRoom.playerCount) > 1;
        });
        
        if (needsRefresh && fetchCounter < 2) {
          // 如果需要再次刷新且未超過最大重試次數，則立即再次刷新
          setTimeout(() => {
            setFetchCounter(prev => prev + 1);
            fetchRooms();
          }, 500);
        } else {
          setFetchCounter(0);
        }
        
        return roomsWithPlayers;
      });
      
      setLoading(false);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("獲取房間列表時出錯:", err);
      setError("無法載入房間列表，請確認後端伺服器是否已啟動");
      setLoading(false);
    }
  }, [fetchCounter]);

  // 初始加載和自動刷新
  useEffect(() => {
    // 初始加載
    fetchRooms();
    
    // 設置定時器，每2秒自動刷新一次（更頻繁地刷新）
    const refreshInterval = setInterval(fetchRooms, 2000);
    
    // 清理函數，組件卸載時清除定時器
    return () => clearInterval(refreshInterval);
  }, [fetchRooms]);

  // 手動刷新函數
  const handleRefresh = () => {
    fetchRooms();
  };

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h2>可加入的遊戲房間</h2>
        <button
          onClick={handleRefresh}
          className="refresh-btn"
          disabled={loading}
        >
          {loading ? "刷新中..." : "刷新列表"}
        </button>
      </div>

      {loading && rooms.length === 0 ? (
        <p>載入中...</p>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : rooms.length > 0 ? (
        <>
          <p>以下是現有的遊戲房間，請點擊加入：</p>
          <ul className="rooms">
            {rooms.map((room) => (
              <li key={room.id || room.name}>
                <Link className="room-link" to={`/game/${room.name}`}>
                  {room.name}
                </Link>
                <div className="room-details">
                  <span className="room-players">
                    目前人數: {room.playerCount || 0} 人
                  </span>
                  <span className="room-info">
                    創建於{" "}
                    {new Date(room.created_at).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {lastUpdated && (
            <div className="last-updated">
              上次更新: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </>
      ) : (
        <p>目前沒有活躍的遊戲房間。請創建一個新房間開始遊戲！</p>
      )}
    </div>
  );
};

export default RoomList;
