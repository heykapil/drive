import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="flex flex-row ml-2 items-center mt-10 min-h-fit">
      {/* Spinner */}
      <div className="three-body">
      <div className="three-body__dot"></div>
      <div className="three-body__dot"></div>
      <div className="three-body__dot"></div>
      </div>
      <span className='text-violet-500 flex ml-4'>Hold on! Please wait...</span>
    </div>
  );
};

export default Loading;
