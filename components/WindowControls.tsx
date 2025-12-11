import React from 'react';

const WindowControls: React.FC = () => {
  return (
    <div className="flex gap-2 items-center px-4 py-3">
      <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#E0443E] hover:brightness-90 transition-all cursor-default"></div>
      <div className="w-3 h-3 rounded-full bg-[#FEBC2E] border border-[#D89E24] hover:brightness-90 transition-all cursor-default"></div>
      <div className="w-3 h-3 rounded-full bg-[#28C840] border border-[#1AAB29] hover:brightness-90 transition-all cursor-default"></div>
    </div>
  );
};

export default WindowControls;
