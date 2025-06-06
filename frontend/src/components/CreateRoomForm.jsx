import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";

const CreateRoomForm = ({ onCreate }) => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch("http://127.0.0.1:8000/api/rooms/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: roomName }),
    })
      .then(res => {
        if (!res.ok) throw new Error("後端回傳失敗");
        return res.json();
      })
      .then((data) => {
        console.log("房間建立成功", data);
        setRoomName("");
        navigate(`/game/${data.name}`); 
      }).catch(err => {
        console.error("創建房間失敗", err);
        alert("建立房間失敗，請確認 Django server 是否有正確開啟 /api/rooms/");
      });
  };

  return (
    <div className="create-room-container">
      <h2>創建新房間</h2>
      <form onSubmit={handleSubmit} className="create-room-form">
        <div className="input-container">
          <input
            type="text"
            placeholder="輸入房間名稱..."
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            required
            className="room-name-input"
          />
          <button type="submit" className="create-btn">創建房間</button>
        </div>
      </form>
    </div>
  );
};

export default CreateRoomForm;
