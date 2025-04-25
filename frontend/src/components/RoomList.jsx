import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/home.css";

const RoomList = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch("http://127.0.0.1:8000/api/rooms/")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch rooms");
        return res.json();
      })
      .then((data) => {
        // 獲取每個房間的人數
        const fetchPlayerCounts = data.map(room => 
          fetch(`http://127.0.0.1:8000/api/games/?room=${room.id}`)
            .then(res => res.json())
            .then(gameData => {
              if (gameData.length > 0 && gameData[0].players) {
                return { ...room, playerCount: gameData[0].players.length };
              }
              return { ...room, playerCount: 0 };
            })
            .catch(() => ({ ...room, playerCount: 0 }))
        );
        
        return Promise.all(fetchPlayerCounts);
      })
      .then((roomsWithPlayerCount) => {
        setRooms(roomsWithPlayerCount);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching rooms:", err);
        setError("無法載入房間列表，請確認後端伺服器是否已啟動");
        setLoading(false);
      });
  }, []);

  return (
    <div className="room-list">
      <h2>可加入的遊戲房間</h2>
      {loading ? (
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
                  <span className="room-players">目前人數: {room.playerCount || 0} 人</span>
                  <span className="room-info">創建於 {new Date(room.created_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>目前沒有活躍的遊戲房間。請創建一個新房間開始遊戲！</p>
      )}
    </div>
  );
};

export default RoomList;
