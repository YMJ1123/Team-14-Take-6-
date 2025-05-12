import React, { useEffect, useState } from "react";
import "../styles/card.css";

const Card = ({ value, bullHeads, isPlayed = false, isBack = false, onClick, smallSize = false, isDealing = false }) => {
  const [isAnimating, setIsAnimating] = useState(isDealing);

  // 設置動畫效果
  useEffect(() => {
    if (isDealing) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDealing]);

  // 根據牛頭數量確定卡牌顏色 - 確保相同牛頭數有相同顏色
  const getCardColor = () => {
    if (isBack) return "card-back";
    
    switch(bullHeads) {
      case 1: return "card-color-1";
      case 2: return "card-color-2";
      case 3: return "card-color-3";
      case 5: return "card-color-5";
      case 7: return "card-color-7";
      default: return "card-color-1";
    }
  };

  // 如果是卡牌背面
  if (isBack) {
    return (
      <div className={`card card-back ${smallSize ? 'card-small' : ''} ${isAnimating ? 'dealing' : ''}`} onClick={onClick}>
        <div className="card-inner">
          <div className="card-design"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`card ${getCardColor()} ${isPlayed ? 'played' : ''} ${smallSize ? 'card-small' : ''} ${isAnimating ? 'dealing' : ''}`}
      onClick={onClick}
    >
      <div className="card-inner">
        <div className="card-number">{value}</div>
        <div className="bull-heads">
          {[...Array(bullHeads)].map((_, i) => (
            <img 
              key={i}
              src="/images/bull-head-icon.png" 
              alt="Bull Head" 
              className="bull-head-icon"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Card;