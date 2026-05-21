import { useState, useEffect } from "react";

export const useGreeting = () => {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      
      // 05:00 até 11:59 -> Bom dia
      // 12:00 até 17:59 -> Boa tarde
      // 18:00 até 04:59 -> Boa noite
      
      if (hour >= 5 && hour < 12) {
        setGreeting("Bom dia");
      } else if (hour >= 12 && hour < 18) {
        setGreeting("Boa tarde");
      } else {
        setGreeting("Boa noite");
      }
    };

    // Initial update
    updateGreeting();

    // Update every minute to catch hour transitions
    const interval = setInterval(updateGreeting, 60000);

    return () => clearInterval(interval);
  }, []);

  return greeting;
};
