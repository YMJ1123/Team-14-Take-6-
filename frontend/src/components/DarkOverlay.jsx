// Dark overlay component to be added to pages for enhanced casino atmosphere
import React from 'react';

const DarkOverlay = () => {
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none', // Makes the overlay non-interactive
    zIndex: -1,
    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.5) 100%)',
    opacity: 0.8,
  };
  
  return <div className="casino-dark-overlay" style={overlayStyle}></div>;
};

export default DarkOverlay;
