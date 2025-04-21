import React, { useEffect, useState } from "react";
import "../styles/game_room.css";

const PlayerHand = ({ socket }) => {
  const [hand, setHand] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "deal_cards") {
        setHand(data.hand);
      }
    };
  }, [socket]);

  const playCard = (cardIndex) => {
    socket.send(JSON.stringify({
      type: "play_card",
      card_idx: cardIndex,
    }));
  };

  return (
    <>
      <h2>你的手牌:</h2>
      <div id="playerHand">
        {hand.map((card, index) => (
          <div
            className="card"
            key={index}
            onClick={() => playCard(index)}
            style={{ cursor: "pointer" }}
          >
            <h3>{card.value}</h3>
            <p>牛頭數: {card.bull_heads}</p>
          </div>
        ))}
      </div>
    </>
  );
};

export default PlayerHand;
