import React, { ReactNode } from 'react';

interface LayoutProps {
  toolbar: ReactNode;
  content: ReactNode;
  statusBar: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  toolbar,
  content,
  statusBar,
}) => {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-none">{toolbar}</div>
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-hidden">{content}</div>
      </div>
      <div className="flex-none">{statusBar}</div>
    </div>
  );
};

export default Layout;