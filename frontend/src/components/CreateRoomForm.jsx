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
        // onCreate(data.name); // 透過 props 通知 Home 切換頁面
      }).catch(err => {
        console.error("創建房間失敗", err);
        alert("建立房間失敗，請確認 Django server 是否有正確開啟 /api/rooms/");
      });
  };

  return (
    <div className="create-room">
      <h3>創建新房間</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="房間名稱"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          required
        />
        <button type="submit">創建</button>
      </form>
    </div>
  );
};

export default CreateRoomForm;
