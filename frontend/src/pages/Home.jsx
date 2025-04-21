import React, {useState} from "react";
import RoomList from "../components/RoomList";
import CreateRoomForm from "../components/CreateRoomForm";
import AboutGame from "../components/AboutGame";
import ApiDocs from "../components/ApiDocs";
import "../styles/home.css";

const Home = () => {
  const [roomName, setRoomName] = useState(null); // 控制要不要切換
  
  return (
    // <div className="container">
    //   <h1>Take 6! Online 線上牛頭王</h1>
    //   <p>歡迎來到 Take 6! Online 遊戲平台。</p>
    //   <RoomList />
    //   <CreateRoomForm />
    //   <AboutGame />
    //   <ApiDocs />
    // </div>
    <div className="container">
      {roomName ? (
        <GameRoom roomName={roomName} />
      ) : (
        <>
          <h1>Take 6! Online 線上牛頭王</h1>
          <p>歡迎來到 Take 6! Online 遊戲平台。</p>
          <RoomList />
          <CreateRoomForm onCreate={(name) => setRoomName(name)} />
          <AboutGame />
          <ApiDocs />
        </>
      )}
    </div>
  );
};

export default Home;
