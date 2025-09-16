import React from 'react';

const SocialLinks: React.FC = () => {
  return (
    <div className="flex items-center justify-center space-x-6">
      <a
        href="https://github.com/Cyrus-Krispin"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-white transition-colors duration-200"
        aria-label="GitHub"
      >
        <img src="/github.svg" alt="GitHub" className="w-8 h-8" />
      </a>
      <a
        href="https://www.linkedin.com/in/cyruskrispin/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-white transition-colors duration-200"
        aria-label="LinkedIn"
      >
        <img src="/linkedin.svg" alt="LinkedIn" className="w-8 h-8" />
      </a>
      <a
        href="https://leetcode.com/u/cyrus-krispin/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-white transition-colors duration-200"
        aria-label="LeetCode"
      >
        <img src="/leetcode.svg" alt="LeetCode" className="w-8 h-8" />
      </a>
    </div>
  );
};

export default SocialLinks;
