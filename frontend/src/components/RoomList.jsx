import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/home.css";

const RoomList = () => {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    fetch("/api/rooms/")
      .then((res) => res.json())
      .then((data) => setRooms(data));
  }, []);

  return (
    <div className="room-list">
      <h2>遊戲房間</h2>
      {rooms.length > 0 ? (
        <ul className="rooms">
          {rooms.map((room) => (
            <li key={room.name}>
              房間: <Link className="room-link" to={`/room/${room.name}`}>{room.name}</Link>
              <small>（創建於 {room.created_at}）</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>目前沒有活躍的遊戲房間。</p>
      )}
    </div>
  );
};

export default RoomList;
