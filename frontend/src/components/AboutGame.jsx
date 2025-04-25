import React from "react";
import "../styles/home.css";

const AboutGame = () => (
  <div className="game-rules">
    <h2>遊戲介紹</h2>
    <p>Take 6! 是一款卡牌遊戲，適合2-10名玩家。</p>
    <ul>
      <li>共104張牌（1-104號，每張牌有不同牛頭數量）</li>
      <li>每局10回合，每位玩家持有10張牌</li>
      <li>玩家每回合同時出一張牌</li>
      <li>將牌依號碼大小順序放入桌面的4列牌中</li>
      <li>最後牛頭數最少的玩家獲勝</li>
    </ul>
  </div>
);

export default AboutGame;
