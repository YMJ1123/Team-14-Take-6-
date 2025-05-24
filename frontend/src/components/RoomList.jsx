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
      // 加時間戳以便在 fetch options 裡做 no-store cache
      const timestamp = new Date().getTime();

      // 1. 獲取房間列表
      const roomsResponse = await fetch(
        `${API_BASE}/api/rooms/?_=${timestamp}`,
        { cache: "no-store" }
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
            const playerCountResponse = await fetch(
              `${API_BASE}/api/rooms/${room.id}/player_count/?_=${timestamp}`,
              { cache: "no-store" }
            );
            if (playerCountResponse.ok) {
              const playerCountData = await playerCountResponse.json();
              if (playerCountData.player_count !== undefined) {
                counts.push(playerCountData.player_count);
              }
            }
          } catch (error) {
            console.log(
              `使用 player_count 端點獲取房間 ${room.name} 的玩家數量失敗:`,
              error
            );
          }

          // 方法2: active_rooms endpoint
          try {
            const wsRoomResponse = await fetch(
              `${API_BASE}/api/active_rooms/${room.name}/?_=${timestamp}`,
              { cache: "no-store" }
            );
            if (wsRoomResponse.ok) {
              const wsRoomData = await wsRoomResponse.json();
              if (wsRoomData.player_count !== undefined) {
                counts.push(wsRoomData.player_count);
              }
            }
          } catch (error) {
            console.log(
              `使用 active_rooms 端點獲取房間 ${room.name} 的玩家數量失敗:`,
              error
            );
          }

          // 方法3: 從 games endpoint 取得
          try {
            const gameResponse = await fetch(
              `${API_BASE}/api/games/?room=${room.id}&_=${timestamp}`,
              { cache: "no-store" }
            );
            if (gameResponse.ok) {
              const gameData = await gameResponse.json();
              if (Array.isArray(gameData) && gameData.length > 0) {
                if (Array.isArray(gameData[0].players)) {
                  counts.push(gameData[0].players.length);
                }
                if (gameData[0].connected_players) {
                  counts.push(
                    Object.keys(gameData[0].connected_players).length
                  );
                }
              }
            }
          } catch (error) {
            console.log(
              `使用 games 端點獲取房間 ${room.name} 的玩家數量失敗:`,
              error
            );
          }

          // 取最常見的值
          if (counts.length > 0) {
            const countMap = {};
            let maxCount = 0;
            let mostFrequent = 0;
            counts.forEach((c) => {
              countMap[c] = (countMap[c] || 0) + 1;
              if (countMap[c] > maxCount) {
                maxCount = countMap[c];
                mostFrequent = c;
              }
            });
            playerCount = mostFrequent;
          }

          return {
            ...room,
            playerCount: Math.max(0, playerCount),
            _debug_counts: counts,
          };
        })
      );

      // 更新 state，並根據變化決定是否重試
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
    const refreshInterval = setInterval(fetchRooms, 2000);
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
