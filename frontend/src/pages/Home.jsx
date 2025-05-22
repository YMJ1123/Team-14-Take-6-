import React, { useEffect, useState } from "react";
import { useSearchParams } from 'react-router-dom';
import RoomList from "../components/RoomList";
import CreateRoomForm from "../components/CreateRoomForm";
import AboutGame from "../components/AboutGame";
import ApiDocs from "../components/ApiDocs";
import AuthForms from "../components/AuthForms";
import "../styles/home.css";
import "../styles/auth-new.css";

const Home = () => {
  const [searchParams] = useSearchParams();
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  
  useEffect(() => {
    // Check if redirected with requireLogin parameter
    if (searchParams.get('requireLogin') === 'true') {
      setShowLoginAlert(true);
      
      // Auto-hide the alert after 5 seconds
      const timer = setTimeout(() => {
        setShowLoginAlert(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="container">
      <h1>Take 6! Online 線上牛頭王</h1>
      <p>歡迎來到 Take 6! Online 遊戲平台。選擇一個房間加入，或創建一個新房間開始遊戲！</p>
      
      {showLoginAlert && (
        <div className="login-alert">
          請先登入後再進入遊戲房間
        </div>
      )}
      
      <AuthForms />
      <RoomList />
      <CreateRoomForm />
      <AboutGame />
      <ApiDocs />
    </div>
  );
};

export default Home;
