// 之後可刪
import React from "react";
import "../styles/home.css";

const ApiDocs = () => (
  <div className="api-section">
    <h2>API 端點</h2>
    <ul>
      <li><code>/api/rooms/</code> - 管理遊戲房間</li>
      <li><code>/api/games/</code> - 查詢遊戲資訊</li>
      <li><code>/api/players/</code> - 查詢玩家資訊</li>
    </ul>
  </div>
);

export default ApiDocs;
