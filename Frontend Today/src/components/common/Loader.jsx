import React, { useState, useEffect } from 'react';
import './Loader.css';

const Loader = ({ show }) => {
  const [isVisible, setIsVisible] = useState(show);
  const [displayText, setDisplayText] = useState('');
  const [isAnimationFinished, setIsAnimationFinished] = useState(false);
  const fullText = 'ZirakBook';

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsAnimationFinished(false);
      let i = 0;
      setDisplayText('');
      // Faster typing speed (80ms)
      const interval = setInterval(() => {
        if (i < fullText.length) {
          setDisplayText(fullText.substring(0, i + 1));
          i++;
        } else {
          clearInterval(interval);
          setIsAnimationFinished(true);
        }
      }, 80);
      return () => clearInterval(interval);
    }
  }, [show]);

  // Only hide the loader when both the 'show' prop is false AND the animation has finished typing
  useEffect(() => {
    if (!show && isAnimationFinished) {
      const timeout = setTimeout(() => setIsVisible(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [show, isAnimationFinished]);

  if (!isVisible) return null;

  // Split the text for different styling
  const zirakPart = displayText.substring(0, 5); // "Zirak" is 5 chars
  const bookPart = displayText.substring(5);

  return (
    <div className={`global-loader-container ${show ? 'fade-in' : 'fade-out'}`}>
      <div className="loader-content">
        <div className="loader-logo">
          <span className="text-zirak">{zirakPart}</span>
          <span className="text-book">{bookPart}</span>
          <span className="cursor">|</span>
        </div>
        <div className="loader-bar-container">
          <div className="loader-bar"></div>
        </div>
      </div>
    </div>
  );
};

export default Loader;
