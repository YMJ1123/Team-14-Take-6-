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
      // 1. 獲取房間列表（已經包含 player_count）
      const roomsResponse = await fetch(
        `${API_BASE}/api/rooms/`,
        { cache: "no-store", credentials: "include" }
      );
      if (!roomsResponse.ok) {
        throw new Error("無法獲取房間列表");
      }
      const roomsData = await roomsResponse.json(); // roomsData will now contain player_count for each room
      
      // roomsData is already in the desired format { ...room, playerCount: room.player_count }
      // No need for roomsWithPlayers mapping if backend provides player_count directly.
      
      // 更新 state 並控制重試
      // The retry logic might need adjustment if it was based on player count changes from separate fetches.
      // For now, we'll simplify and remove the complex retry based on individual player count fetches.
      setRooms(roomsData);
      
      setLoading(false);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("獲取房間列表時出錯:", err);
      setError("無法載入房間列表，請確認後端伺服器是否已啟動");
      setLoading(false);
    }
  }, []);

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
