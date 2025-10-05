import React from 'react';

interface LayoutProps {
  toolbar: React.ReactNode;
  content: React.ReactNode;
  statusBar: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ toolbar, content, statusBar }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0">
        {toolbar}
      </div>
      <div className="flex-1 overflow-hidden">
        {content}
      </div>
      <div className="flex-shrink-0">
        {statusBar}
      </div>
    </div>
  );
};

export default Layout;
