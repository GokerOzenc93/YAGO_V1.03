import React from 'react';

const StatusBar: React.FC = () => {
  return (
    <div className="flex items-center h-6 px-4 bg-stone-800 text-stone-300 text-xs border-t border-stone-700">
      <span className="font-medium">Ready</span>
      <div className="ml-auto flex items-center gap-4">
        <span>Objects: 0</span>
        <span>Selected: None</span>
      </div>
    </div>
  );
};

export default StatusBar;
