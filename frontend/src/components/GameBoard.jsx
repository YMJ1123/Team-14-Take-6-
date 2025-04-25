import React, { useState, useEffect } from "react";
import "../styles/game_room.css";

const GameBoard = ({ socket }) => {
  const [board, setBoard] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "update_board") {
        setBoard(data.board);
      }
    };

    socket.addEventListener("message", handleMessage);
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  return (
    <div id="gameBoard">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          <h3>第 {rowIndex + 1} 列</h3>
          {row.map((card, i) => (
            <div key={i} className="card played">
              <h3>{card.value}</h3>
              <p>牛頭數: {card.bull_heads}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default GameBoard;
