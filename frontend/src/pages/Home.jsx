import React from "react";
import RoomList from "../components/RoomList";
import CreateRoomForm from "../components/CreateRoomForm";
import AboutGame from "../components/AboutGame";
import ApiDocs from "../components/ApiDocs";
import "../styles/home.css";

const Home = () => {
  return (
    <div className="container">
      <h1>Take 6! Online 線上牛頭王</h1>
      <p>歡迎來到 Take 6! Online 遊戲平台。選擇一個房間加入，或創建一個新房間開始遊戲！</p>
      
      <RoomList />
      <CreateRoomForm />
      <AboutGame />
      <ApiDocs />
    </div>
  );
};

export default Home;
