'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TransitionLayout({ children }: {children: React.ReactNode}) {
  const pathname = usePathname();
  const [transitionStage, setTransitionStage] = useState('fade-in');

  useEffect(() => {
    // Start the exit animation
    setTransitionStage('fade-out');

    // When the route changes, wait for the exit animation to complete
    const timeoutId = setTimeout(() => {
      setTransitionStage('fade-in');
    }, 300); // adjust this duration to match your CSS transition duration

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return <div className={transitionStage}>{children}</div>;
}
