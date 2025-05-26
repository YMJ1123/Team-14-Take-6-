import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import "../styles/home.css";

// 直接從環境變數讀取後端 API 根網址
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const RoomList = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchCounter, setFetchCounter] = useState(0);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 獲取房間列表（不帶時間戳）
      const roomsResponse = await fetch(
        `${API_BASE}/api/rooms/`,
        { cache: "no-store", credentials: "include" }
      );
      if (!roomsResponse.ok) {
        throw new Error("無法獲取房間列表");
      }
      const roomsData = await roomsResponse.json();
      
      // 2. 為每個房間獲取玩家數量
      const roomsWithPlayers = await Promise.all(
        roomsData.map(async (room) => {
          let playerCount = 0;
          let counts = [];
          
          // 方法1: player_count endpoint
          try {
            const resp = await fetch(
              `${API_BASE}/api/rooms/${room.id}/player_count/`,
              { cache: "no-store", credentials: "include" }
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data.player_count !== undefined) {
                counts.push(data.player_count);
              }
            }
          } catch (err) {
            console.log(`player_count 端點失敗:`, err);
          }
          
          // Method 2: active_rooms endpoint (REMOVED)
          /*
          try {
            const resp = await fetch(
              `${API_BASE}/api/active_rooms/${room.name}/`,
              { cache: "no-store", credentials: "include" } 
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data.player_count !== undefined) {
                counts.push(data.player_count);
              }
            }
          } catch (err) {
            console.log(`active_rooms 端點失敗:`, err);
          }
          */

          // 方法3: games endpoint
          try {
            const resp = await fetch(
              `${API_BASE}/api/games/?room=${room.id}`,
              { cache: "no-store", credentials: "include" }
            );
            if (resp.ok) {
              const data = await resp.json();
              if (Array.isArray(data) && data.length > 0) {
                if (Array.isArray(data[0].players)) {
                  counts.push(data[0].players.length);
                }
                if (data[0].connected_players) {
                  counts.push(
                    Object.keys(data[0].connected_players).length
                  );
                }
              }
            }
          } catch (err) {
            console.log(`games 端點失敗:`, err);
          }
          
          // 取最常見的值
          if (counts.length > 0) {
            const freq = {};
            let best = 0, maxCount = 0;
            counts.forEach((c) => {
              freq[c] = (freq[c] || 0) + 1;
              if (freq[c] > maxCount) {
                maxCount = freq[c];
                best = c;
              }
            });
            playerCount = best;
          }
          
          return { 
            ...room, 
            playerCount: Math.max(0, playerCount),
            _debug_counts: counts
          };
        })
      );
      
      // 更新 state 並控制重試
      setRooms((prev) => {
        const needsRefresh = roomsWithPlayers.some((newR, i) => {
          const oldR = prev[i];
          return oldR && Math.abs(newR.playerCount - oldR.playerCount) > 1;
        });
        if (needsRefresh && fetchCounter < 2) {
          setTimeout(() => {
            setFetchCounter((c) => c + 1);
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

  useEffect(() => {
    fetchRooms();
    const refreshInterval = setInterval(fetchRooms, 20000);
    return () => clearInterval(refreshInterval);
  }, [fetchRooms]);

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
