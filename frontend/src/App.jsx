import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import GameRoom from "./pages/GameRoom";
import AuthProvider from "./components/AuthProvider";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:roomName" element={<GameRoom />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
