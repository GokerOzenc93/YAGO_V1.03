import React from 'react';

interface LayoutProps {
  toolbar: React.ReactNode;
  content: React.ReactNode;
  statusBar: React.ReactNode;
}

export default function Layout({ toolbar, content, statusBar }: LayoutProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-gray-700">
        {toolbar}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {content}
      </div>
      
      {/* Status Bar */}
      <div className="flex-shrink-0 border-t border-gray-700">
        {statusBar}
      </div>
    </div>
  );
}