import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import GameRoom from "./pages/GameRoom";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomName" element={<GameRoom />} />
      </Routes>
    </Router>
  );
}

export default App;
